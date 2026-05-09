// Create Recipe Logic
document.addEventListener('DOMContentLoaded', () => {
    const createModal = document.getElementById('create-modal');
    const openModalBtn = document.querySelector('.user-only .btn-primary');
    const closeModalBtn = document.querySelector('.close-modal');
    const createForm = document.getElementById('create-recipe-form');

    if (openModalBtn) {
        openModalBtn.onclick = () => {
            createModal.style.display = 'block';
        };
    }

    if (closeModalBtn) {
        closeModalBtn.onclick = () => {
            createModal.style.display = 'none';
        };
    }

    window.onclick = (event) => {
        if (event.target == createModal) {
            createModal.style.display = 'none';
        }
    };

    if (createForm) {
        createForm.onsubmit = async (e) => {
            e.preventDefault();
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const recipeData = {
                name: document.getElementById('new-recipe-name').value,
                category: document.getElementById('new-recipe-category').value,
                description: document.getElementById('new-recipe-desc').value,
                time: document.getElementById('new-recipe-time').value,
                servings: document.getElementById('new-recipe-servings').value,
                image: document.getElementById('new-recipe-img').value,
                user_id: user.id || 0
            };

            try {
                const response = await fetch('/api/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(recipeData)
                });

                if (response.ok) {
                    createModal.style.display = 'none';
                    createForm.reset();
                    alert('Recipe created successfully!');
                    if (window.fetchRecipes) {
                        window.fetchRecipes(window.currentSearch); // Reload grid
                    }
                }
            } catch (err) {
                console.error("Failed to create recipe:", err);
            }
        };
    }
});
