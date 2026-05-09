document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const recipeId = urlParams.get('id');

    if (!recipeId) {
        window.location.href = 'index.html';
        return;
    }

    loadRecipeDetails(recipeId);
    loadSimilarRecipes(recipeId);
});

async function loadRecipeDetails(id) {
    try {
        const response = await fetch(`/api/recipe/${id}`);
        const recipe = await response.json();

        if (recipe.error) {
            alert('Recipe not found');
            window.location.href = 'index.html';
            return;
        }

        // Populate elements
        document.title = `${recipe.recipe_name} | Dishcovery`;
        document.getElementById('breadcrumb-recipe-name').textContent = recipe.recipe_name.toUpperCase();
        document.getElementById('recipe-title').textContent = recipe.recipe_name;
        document.getElementById('recipe-main-img').src = recipe.img_src || 'https://images.unsplash.com/photo-1495195134817-aeb325a55b65?auto=format&fit=crop&w=1200&q=80';
        document.getElementById('recipe-servings').textContent = `${recipe.servings} portion`;
        
        // Description - use the one from DB or a fallback
        const desc = recipe.description || "A delicious and simple dish that you'll absolutely love making and eating. Perfectly seasoned and prepared with fresh ingredients.";
        document.getElementById('recipe-description').textContent = desc;

        // Ingredients
        const ingredientsList = document.getElementById('ingredients-list');
        if (recipe.ingredients_list && Array.isArray(recipe.ingredients_list)) {
            ingredientsList.innerHTML = recipe.ingredients_list.map(ing => `
                <li>${ing}</li>
            `).join('');
        } else {
            ingredientsList.innerHTML = '<li>No ingredients listed.</li>';
        }

        // Instructions
        const instructionsList = document.getElementById('instructions-list');
        if (recipe.directions_list && recipe.directions_list.length > 0) {
            instructionsList.innerHTML = recipe.directions_list.map((step, index) => `
                <div class="step-item">
                    <div class="step-number">${index + 1}</div>
                    <div class="step-content">
                        <h3>${getStepTitle(step)}</h3>
                        <p>${step}</p>
                    </div>
                </div>
            `).join('');
        } else {
            instructionsList.innerHTML = '<p>No instructions available for this recipe.</p>';
        }

    } catch (err) {
        console.error('Failed to load recipe:', err);
    }
}

function getStepTitle(step) {
    // Basic logic to generate a step title from content
    const words = step.split(' ');
    if (words.length > 3) {
        return words.slice(0, 3).join(' ') + '...';
    }
    return 'Preparation';
}

async function loadSimilarRecipes(id) {
    console.log('Loading similar recipes for ID:', id);
    try {
        const response = await fetch(`/api/similar/${id}`);
        const similar = await response.json();
        console.log('Similar recipes received:', similar);

        const grid = document.getElementById('similar-recipes-grid');
        if (!grid) {
            console.error('Similar recipes grid element not found!');
            return;
        }

        if (similar.length === 0) {
            grid.innerHTML = '<p>No similar recipes found.</p>';
            return;
        }

        grid.innerHTML = similar.map(r => renderMiniCard(r)).join('');
    } catch (err) {
        console.error('Failed to load similar recipes:', err);
    }
}

function renderMiniCard(r) {
    const time = String(r.time || '20 MIN');
    const servings = String(r.servings || '2 SERVES');
    const image = r.image || 'https://images.unsplash.com/photo-1495195134817-aeb325a55b65?auto=format&fit=crop&w=600&q=80';
    const name = r.name;
    const desc = r.ingredients ? r.ingredients.join(', ').slice(0, 80) + '...' : "A delicious choice from our collection.";

    return `
        <div class="recipe-card">
            <div class="recipe-img">
                <img src="${image}" alt="${name}">
            </div>
            <div class="recipe-content">
                <h3>${name}</h3>
                <p>${desc}</p>
                <div class="recipe-card-footer">
                    <div class="recipe-meta">
                        <div class="meta-item"><i class="far fa-clock"></i> ${time.toUpperCase()}</div>
                        <div class="meta-item"><i class="far fa-user"></i> ${servings.toUpperCase().includes('SERVE') ? servings.toUpperCase() : servings.toUpperCase() + ' SERVES'}</div>
                    </div>
                    <div class="fav-actions">
                        <i class="far fa-heart heart-btn"></i>
                        <button class="view-btn" onclick="window.location.href='view_recipe.html?id=${r.id}'">VIEW RECIPE</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Navbar Scroll Effect (Copy from script.js)
window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (window.scrollY > 50) {
        nav.style.top = '1rem';
        nav.style.width = '95%';
        nav.style.padding = '0.6rem 2rem';
    } else {
        nav.style.top = '1.5rem';
        nav.style.width = '92%';
        nav.style.padding = '0.7rem 2rem';
    }
});

// Heart Toggle
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('heart-btn')) {
        e.target.classList.toggle('fas');
        e.target.classList.toggle('far');
        e.target.classList.toggle('active');
    }
});
