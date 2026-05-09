import sqlite3
import os

DB_PATH = 'recipes.db'

def check_schema():
    if not os.path.exists(DB_PATH):
        print(f"Error: {DB_PATH} not found.")
        return
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Table names
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print(f"Tables: {tables}")
    
    for table in tables:
        table_name = table[0]
        print(f"\nSchema for {table_name}:")
        cursor.execute(f"PRAGMA table_info({table_name});")
        info = cursor.fetchall()
        for col in info:
            print(col)
            
        # Sample row
        cursor.execute(f"SELECT * FROM {table_name} LIMIT 1;")
        row = cursor.fetchone()
        print(f"Sample row: {row}")
        
    conn.close()

if __name__ == '__main__':
    check_schema()
