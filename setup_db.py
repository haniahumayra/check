import sqlite3
import pandas as pd
import os

CSV_PATH = '../recipes.csv'
DB_PATH = 'recipes.db'

def setup_database():
    if not os.path.exists(CSV_PATH):
        print(f"Error: {CSV_PATH} not found.")
        return

    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_csv(CSV_PATH)
    
    # Fill NaN
    df = df.fillna('')
    
    # Categorization logic
    def classify_recipe(row):
        name = str(row['recipe_name']).lower()
        path = str(row['cuisine_path']).lower()

        dessert_keywords = [
            'dessert', 'cake', 'cookies', 'cookie', 'brownies', 'pudding',
            'ice cream', 'icecream', 'chocolate', 'sweet', 'pie', 'tart',
            'cupcake', 'muffin', 'donut', 'caramel', 'custard', 'crisp',
            'cobbler', 'mousse', 'sorbet', 'gelato', 'pastry', 'crepe',
            'jam', 'jelly', 'marmalade', 'syrup', 'honey', 'fruit', 'berry',
            'strawberry', 'blueberry', 'peach', 'trifle'
        ]

        breakfast_keywords = [
            'breakfast', 'brunch', 'pancake', 'waffle', 'omelette',
            'omelet', 'toast', 'cereal', 'granola', 'smoothie',
            'scrambled egg', 'fried egg', 'boiled egg', 'oatmeal', 'porridge'
        ]

        main_dish_keywords = [
            'chicken', 'beef', 'pasta', 'rice', 'noodle', 'soup',
            'steak', 'curry', 'salad', 'sandwich', 'burger',
            'pizza', 'grill', 'roast', 'fried', 'pork', 'lamb',
            'fish', 'seafood', 'tofu', 'vegetable', 'shrimp', 'salmon',
            'spaghetti', 'taco', 'burrito', 'stew', 'meat'
        ]

        # PRIORITY 1: Dessert (Catch all sweet/drinks first)
        for keyword in dessert_keywords:
            if keyword in name or keyword in path:
                return 'Dessert'

        # PRIORITY 2: Breakfast
        for keyword in breakfast_keywords:
            if keyword in name or keyword in path:
                return 'Breakfast'

        # PRIORITY 3: Main Dish (Strict check)
        for keyword in main_dish_keywords:
            if keyword in name or keyword in path:
                return 'Main Dish'

        # Fallback: If it's not Breakfast or Dessert, but has savory ingredients, call it Main Dish
        # Otherwise, put it in Dessert to be safe (since it's likely a snack/side)
        return 'Main Dish'

    # Remove duplicates and generic items
    df = df.drop_duplicates(subset=['recipe_name'])
    
    # HARD BLACKLIST for non-food items
    blacklist = ['margarita', 'cocktail', 'drink', 'mix', 'glaze', 'spread', 'juice', 'syrup', 'alcohol', 'wine', 'beer']
    df = df[~df['recipe_name'].str.lower().str.contains('|'.join(blacklist))]
    
    # Optional: Filter out very short names or non-recipe sounding things
    df = df[df['recipe_name'].str.len() > 3]
    
    df['category'] = df.apply(classify_recipe, axis=1)
    
    # Filter recipes per category
    categories = ['Breakfast', 'Main Dish', 'Dessert']
    final_df_list = []
    
    # For Main Dish, let's pick better ones (longer names)
    main_dish_df = df[df['category'] == 'Main Dish'].copy()
    main_dish_df['name_len'] = main_dish_df['recipe_name'].str.len()
    main_dish_df = main_dish_df.sort_values('name_len', ascending=False).head(40)
    final_df_list.append(main_dish_df.drop(columns=['name_len']))

    # Others
    for cat in ['Breakfast', 'Dessert']:
        cat_df = df[df['category'] == cat].sample(frac=1)
        if cat == 'Breakfast':
            # Exclude smoothies as requested
            cat_df = cat_df[~cat_df['recipe_name'].str.lower().str.contains('smoothie', na=False)]
        
        final_df_list.append(cat_df.head(40))
    
    final_df = pd.concat(final_df_list)
    final_df = final_df.sample(frac=1).reset_index(drop=True)
    
    # NEW: Pick top 100 for Everyone Favorite (Featured)
    # Sort by rating and name length for quality
    featured_df = df.copy()
    featured_df['rating'] = pd.to_numeric(featured_df['rating'], errors='coerce').fillna(0)
    featured_df = featured_df.sort_values(['rating', 'recipe_name'], ascending=[False, True]).head(100)
    
    # Add user_id column (0 = System/Admin)
    final_df['user_id'] = 0
    featured_df['user_id'] = 0
    
    # Write to SQLite
    final_df.to_sql('recipes', conn, index=False)
    featured_df.to_sql('featured', conn, index=False)
    
    # Create indexes and extra tables
    cursor = conn.cursor()
    cursor.execute('CREATE INDEX idx_category ON recipes(category)')
    
    # NEW: Create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            bio TEXT,
            profile_pic TEXT
        )
    ''')
    
    # NEW: Create favorites table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            recipe_id INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (recipe_id) REFERENCES recipes ("Unnamed: 0")
        )
    ''')
    
    # NEW: Create follows table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS follows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            follower_id INTEGER NOT NULL,
            followed_id INTEGER NOT NULL,
            FOREIGN KEY (follower_id) REFERENCES users (id),
            FOREIGN KEY (followed_id) REFERENCES users (id),
            UNIQUE(follower_id, followed_id)
        )
    ''')
    
    # Add a sample user for testing
    cursor.execute('''
        INSERT OR IGNORE INTO users (username, email, password, bio) 
        VALUES (?, ?, ?, ?)
    ''', ('demo_user', 'demo@example.com', 'password123', 'I love cooking Indonesian food!'))
    
    conn.commit()
    conn.close()
    print(f"Database setup complete. Total recipes: {len(final_df)}. Featured: {len(featured_df)}")

if __name__ == '__main__':
    setup_database()
