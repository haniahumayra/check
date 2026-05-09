import sqlite3

DB_PATH = 'recipes.db'

def check_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT category, count(*) FROM recipes GROUP BY category")
    rows = cursor.fetchall()
    for row in rows:
        print(f"{row[0]}: {row[1]}")
    conn.close()

if __name__ == '__main__':
    check_db()
