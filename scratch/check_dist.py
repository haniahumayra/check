import pandas as pd
import os

CSV_PATH = '../recipes.csv'

def check_distribution():
    if not os.path.exists(CSV_PATH):
        print(f"Error: {CSV_PATH} not found.")
        return

    df = pd.read_csv(CSV_PATH)
    df = df.fillna('')
    
    def categorize(row):
        path = str(row['cuisine_path']).lower()
        name = str(row['recipe_name']).lower()
        
        # Priority order and more keywords
        if any(kw in path or kw in name for kw in ['dessert', 'cake', 'sweet', 'cookie', 'pie', 'pudding', 'treat']):
            return 'Dessert'
        if any(kw in path or kw in name for kw in ['breakfast', 'brunch', 'pancake', 'waffle', 'egg', 'muffin', 'oatmeal', 'toast']):
            return 'Breakfast'
        if any(kw in path or kw in name for kw in ['lunch', 'salad', 'sandwich', 'soup', 'wrap', 'burger']):
            return 'Lunch'
        if any(kw in path or kw in name for kw in ['dinner', 'main dish', 'steak', 'roast', 'pasta', 'chicken', 'beef', 'pork', 'fish', 'stew', 'curry']):
            return 'Dinner'
        return 'Other'

    df['category'] = df.apply(categorize, axis=1)
    print(df['category'].value_counts())

if __name__ == '__main__':
    check_distribution()
