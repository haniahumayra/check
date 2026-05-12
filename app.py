# pyrefly: ignore [missing-import]
from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import os
import re

app = Flask(__name__)
DB_PATH = 'recipes.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def clean_ingredients(ing_str):
    if not ing_str: return []
    parts = []
    current = []
    depth = 0
    for char in ing_str:
        if char == '(':
            depth += 1
        elif char == ')':
            depth -= 1
        
        if char == ',' and depth == 0:
            parts.append(''.join(current).strip())
            current = []
        else:
            current.append(char)
    if current:
        parts.append(''.join(current).strip())
    return [p for p in parts if p]

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/featured', methods=['GET'])
def get_featured_recipes():
    conn = get_db_connection()
    recipes = conn.execute("SELECT * FROM featured").fetchall()
    conn.close()
    return jsonify([dict(r) for r in recipes])

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

@app.route('/api/categories', methods=['GET'])
def get_categorized_recipes():
    conn = get_db_connection()
    categories = ['Breakfast', 'Main Dish', 'Dessert']
    output = {}
    
    for cat in categories:
        limit = 12 if cat == 'Main Dish' else 9
        query = "SELECT * FROM recipes WHERE category = ? LIMIT ?"
        recipes = conn.execute(query, (cat, limit)).fetchall()
        output[cat] = [dict(r) for r in recipes]
        
    conn.close()
    return jsonify(output)

@app.route('/api/search', methods=['GET'])
def search_recipes():
    query = request.args.get('q', '').lower()
    include = request.args.getlist('include')
    exclude = request.args.getlist('exclude')

    conn = get_db_connection()
    
    # Base search
    if query:
        sql = "SELECT * FROM recipes WHERE recipe_name LIKE ? LIMIT 100"
        results = conn.execute(sql, (f'%{query}%',)).fetchall()
    else:
        results = conn.execute("SELECT * FROM recipes").fetchall()
    
    conn.close()
    
    processed_results = []
    for row in results:
        ing_list = clean_ingredients(row['ingredients'])
        
        # Check exclusion
        skip = False
        for ex in exclude:
            if any(ex.lower() in ing.lower() for ing in ing_list):
                skip = True
                break
        if skip: continue

        # Match calculation
        match_count = 0
        for inc in include:
            if any(inc.lower() in ing.lower() for ing in ing_list):
                match_count += 1
        
        match_perc = (match_count / len(ing_list)) * 100 if len(ing_list) > 0 else 0
        
        processed_results.append({
            'id': row[0],
            'name': row['recipe_name'],
            'image': row['img_src'],
            'time': row['total_time'],
            'servings': row['servings'],
            'category': row['category'],
            'match': round(match_perc),
            'ingredients': ing_list
        })

    processed_results.sort(key=lambda x: x['match'], reverse=True)
    return jsonify(processed_results)

@app.route('/api/ingredients', methods=['GET'])
def get_search_ingredients():
    query = request.args.get('q', '').lower()
    if not query: return jsonify([])
    
    conn = get_db_connection()
    results = conn.execute("SELECT ingredients FROM recipes WHERE recipe_name LIKE ? LIMIT 50", (f'%{query}%',)).fetchall()
    conn.close()
    
    all_ingredients = set()
    for row in results:
        items = clean_ingredients(row['ingredients'])
        for item in items:
            core = re.sub(r'\d+|ounces|cup|tablespoon|teaspoon|pounds|grams|ml|oz|tbsp|tsp|\/|\.', '', item.lower()).strip()
            if len(core) > 2:
                all_ingredients.add(core)
    
    return jsonify(list(all_ingredients)[:30])

@app.route('/api/recipe/<int:recipe_id>', methods=['GET'])
def get_recipe(recipe_id):
    conn = get_db_connection()
    # Use "Unnamed: 0" as the ID column
    recipe = conn.execute('SELECT * FROM recipes WHERE "Unnamed: 0" = ?', (recipe_id,)).fetchone()
    
    if not recipe:
        # Fallback to rowid just in case
        recipe = conn.execute('SELECT * FROM recipes WHERE rowid = ?', (recipe_id,)).fetchone()
    
    conn.close()
    
    if recipe:
        res = dict(recipe)
        res['ingredients_list'] = clean_ingredients(res['ingredients'])
        # Handle directions - split by newline if exists, otherwise period
        directions = res.get('directions', '')
        if isinstance(directions, str):
            if '\n' in directions:
                res['directions_list'] = [d.strip() for d in directions.split('\n') if d.strip()]
            else:
                res['directions_list'] = [d.strip() for d in directions.split('.') if d.strip()]
        else:
            res['directions_list'] = []
        return jsonify(res)
    return jsonify({'error': 'Recipe not found'}), 404

@app.route('/api/similar/<int:recipe_id>', methods=['GET'])
def get_similar_recipes(recipe_id):
    conn = get_db_connection()
    recipe = conn.execute('SELECT recipe_name FROM recipes WHERE "Unnamed: 0" = ?', (recipe_id,)).fetchone()
    if not recipe:
        recipe = conn.execute('SELECT recipe_name FROM recipes WHERE rowid = ?', (recipe_id,)).fetchone()
        
    if not recipe:
        conn.close()
        return jsonify([])

    name = recipe['recipe_name']
    # Extract keywords from name (exclude common words)
    # Using a better regex to handle more characters
    keywords = re.findall(r'[a-zA-Z]{3,}', name.lower())
    stop_words = {'with', 'and', 'the', 'for', 'from', 'this', 'that', 'with', 'style', 'easy', 'simple', 'roasted', 'herb', 'best', 'quick', 'homemade', 'classic', 'traditional'}
    
    filtered_keywords = [k for k in keywords if k not in stop_words]
    
    # If too few keywords, include proteins even if they are in stop words (though they aren't above)
    if len(filtered_keywords) < 2:
        protein_keywords = {'duck', 'chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'tofu', 'steak', 'pasta', 'soup'}
        additional = [k for k in keywords if k in protein_keywords and k not in filtered_keywords]
        filtered_keywords.extend(additional)

    results_dict = {} # Use dict to avoid duplicates by ID
    
    if filtered_keywords:
        # Search for recipes with similar names
        # Priority 1: Match multiple keywords
        for k in filtered_keywords:
            query_sql = 'SELECT *, "Unnamed: 0" as id FROM recipes WHERE recipe_name LIKE ? AND "Unnamed: 0" != ? LIMIT 10'
            found = conn.execute(query_sql, (f'%{k}%', recipe_id)).fetchall()
            for r in found:
                rid = r['id']
                if rid not in results_dict:
                    results_dict[rid] = r
                if len(results_dict) >= 6: break
            if len(results_dict) >= 6: break
    
    # Fallback: same category if not enough results
    if len(results_dict) < 4:
        cat_query = 'SELECT category FROM recipes WHERE "Unnamed: 0" = ?'
        cat_row = conn.execute(cat_query, (recipe_id,)).fetchone()
        if cat_row:
            extra = conn.execute(
                'SELECT *, "Unnamed: 0" as id FROM recipes WHERE category = ? AND "Unnamed: 0" != ? LIMIT 10', 
                (cat_row['category'], recipe_id)
            ).fetchall()
            for r in extra:
                rid = r['id']
                if rid not in results_dict:
                    results_dict[rid] = r
                if len(results_dict) >= 6: break

    conn.close()
    
    # Format results
    output = []
    for r in list(results_dict.values())[:6]:
        output.append({
            'id': r['id'],
            'name': r['recipe_name'],
            'image': r['img_src'],
            'time': r['total_time'],
            'servings': r['servings'],
            'category': r['category'],
            'ingredients': clean_ingredients(r['ingredients'])
        })
    return jsonify(output)

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not username or not email or not password:
        return jsonify({'error': 'Missing fields'}), 400
        
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
            (username, email, password)
        )
        conn.commit()
        # Get the new user's ID
        user = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        conn.close()
        return jsonify({'success': True, 'user_id': user['id']})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Email already exists'}), 400

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    conn = get_db_connection()
    user = conn.execute(
        "SELECT id, username, email, bio, profile_pic FROM users WHERE email = ? AND password = ?",
        (email, password)
    ).fetchone()
    conn.close()
    
    if user:
        return jsonify({'success': True, 'user': dict(user)})
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/user/<int:user_id>/profile', methods=['GET'])
def get_profile(user_id):
    conn = get_db_connection()
    user = conn.execute("SELECT username, email, bio, profile_pic FROM users WHERE id = ?", (user_id,)).fetchone()
    
    # Get stats
    recipe_count = conn.execute("SELECT COUNT(*) FROM recipes WHERE user_id = ?", (user_id,)).fetchone()[0]
    favorite_count = conn.execute("SELECT COUNT(*) FROM favorites WHERE user_id = ?", (user_id,)).fetchone()[0]
    follower_count = conn.execute("SELECT COUNT(*) FROM follows WHERE followed_id = ?", (user_id,)).fetchone()[0]
    following_count = conn.execute("SELECT COUNT(*) FROM follows WHERE follower_id = ?", (user_id,)).fetchone()[0]
    
    conn.close()
    if user:
        res = dict(user)
        res['stats'] = {
            'recipes': recipe_count,
            'favorites': favorite_count,
            'followers': follower_count,
            'following': following_count
        }
        return jsonify(res)
    return jsonify({'error': 'User not found'}), 404

@app.route('/api/user/follow/toggle', methods=['POST'])
def toggle_follow():
    data = request.json
    follower_id = data.get('follower_id')
    followed_id = data.get('followed_id')
    
    if not follower_id or not followed_id:
        return jsonify({'error': 'Missing follower_id or followed_id'}), 400
        
    if follower_id == followed_id:
        return jsonify({'error': 'You cannot follow yourself'}), 400

    conn = get_db_connection()
    existing = conn.execute(
        "SELECT id FROM follows WHERE follower_id = ? AND followed_id = ?",
        (follower_id, followed_id)
    ).fetchone()
    
    if existing:
        conn.execute("DELETE FROM follows WHERE id = ?", (existing['id'],))
        status = 'unfollowed'
    else:
        conn.execute(
            "INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)",
            (follower_id, followed_id)
        )
        status = 'followed'
        
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'status': status})

@app.route('/api/user/<int:user_id>/recipes', methods=['GET'])
def get_user_recipes(user_id):
    conn = get_db_connection()
    recipes = conn.execute('SELECT *, "Unnamed: 0" as id FROM recipes WHERE user_id = ?', (user_id,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in recipes])

@app.route('/api/user/<int:user_id>/favorites', methods=['GET'])
def get_user_favorites(user_id):
    conn = get_db_connection()
    # Join with recipes table to get full details
    query = '''
        SELECT r.*, r."Unnamed: 0" as id 
        FROM recipes r
        JOIN favorites f ON r."Unnamed: 0" = f.recipe_id
        WHERE f.user_id = ?
    '''
    recipes = conn.execute(query, (user_id,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in recipes])

@app.route('/api/favorite/toggle', methods=['POST'])
def toggle_favorite():
    data = request.json
    user_id = data.get('user_id')
    recipe_id = data.get('recipe_id')
    
    if not user_id or not recipe_id:
        return jsonify({'error': 'Missing user_id or recipe_id'}), 400
        
    conn = get_db_connection()
    # Check if already exists
    existing = conn.execute(
        "SELECT id FROM favorites WHERE user_id = ? AND recipe_id = ?",
        (user_id, recipe_id)
    ).fetchone()
    
    if existing:
        conn.execute("DELETE FROM favorites WHERE id = ?", (existing['id'],))
        status = 'removed'
    else:
        conn.execute(
            "INSERT INTO favorites (user_id, recipe_id) VALUES (?, ?)",
            (user_id, recipe_id)
        )
        status = 'added'
        
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'status': status})

@app.route('/api/user/<int:user_id>/update', methods=['POST'])
def update_profile(user_id):
    data = request.json
    username = data.get('username')
    bio = data.get('bio')
    profile_pic = data.get('profile_pic')
    
    if not username:
        return jsonify({'error': 'Username is required'}), 400
        
    conn = get_db_connection()
    conn.execute(
        "UPDATE users SET username = ?, bio = ?, profile_pic = ? WHERE id = ?",
        (username, bio, profile_pic, user_id)
    )
    conn.commit()
    
    # Get updated user info
    user = conn.execute("SELECT id, username, email, bio, profile_pic FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    
    return jsonify({'success': True, 'user': dict(user)})

@app.route('/api/create', methods=['POST'])
def create_recipe():
    data = request.json
    name = data.get('name')
    category = data.get('category')
    desc = data.get('description')
    time = data.get('time')
    servings = data.get('servings')
    image = data.get('image', '')
    user_id = data.get('user_id', 0) # Default to 0 if not logged in

    if not name or not category:
        return jsonify({'error': 'Missing name or category'}), 400

    conn = get_db_connection()
    conn.execute(
        "INSERT INTO recipes (recipe_name, category, ingredients, img_src, total_time, servings, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (name, category, desc, image, time, servings, user_id)
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True})

    

if __name__ == '__main__':
    app.run(debug=True, port=5001)
