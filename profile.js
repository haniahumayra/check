document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Update Nav visibility
    const createBtn = document.getElementById('nav-create-btn');
    if (createBtn) createBtn.style.display = 'block';

    // --- EDIT PROFILE LOGIC ---
    const editModal = document.getElementById('edit-profile-modal');
    const editTrigger = document.getElementById('edit-profile-trigger');
    const editAvatarTrigger = document.querySelector('.edit-avatar-btn');
    const closeEditModal = document.querySelector('.close-edit-modal');
    const editForm = document.getElementById('edit-profile-form');
    
    const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; // Placeholder for "no person" avatar

    function updateAvatars(src) {
        const url = src || DEFAULT_AVATAR;
        document.getElementById('profile-img').src = url;
        const navAvatar = document.getElementById('nav-avatar');
        if (navAvatar) navAvatar.src = url;
        const mainNavAvatar = document.getElementById('nav-avatar-img');
        if (mainNavAvatar) mainNavAvatar.src = url;
    }

    if (editTrigger) {
        editTrigger.onclick = () => {
            document.getElementById('edit-username').value = user.username;
            document.getElementById('edit-bio').value = user.bio || "";
            document.getElementById('edit-profile-pic').value = user.profile_pic || "";
            editModal.style.display = 'block';
        };
    }

    if (editAvatarTrigger) {
        editAvatarTrigger.onclick = () => editTrigger.click();
    }

    if (closeEditModal) {
        closeEditModal.onclick = () => {
            editModal.style.display = 'none';
        };
    }

    if (editForm) {
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            const updatedData = {
                username: document.getElementById('edit-username').value,
                bio: document.getElementById('edit-bio').value,
                profile_pic: document.getElementById('edit-profile-pic').value
            };

            try {
                const response = await fetch(`/api/user/${user.id}/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });
                const resData = await response.json();
                if (resData.success) {
                    // Update localStorage
                    localStorage.setItem('user', JSON.stringify(resData.user));
                    alert("Profile updated!");
                    window.location.reload();
                }
            } catch (err) {
                console.error("Failed to update profile:", err);
            }
        };
    }

    // Load Profile Info (Updated with default avatar logic)
    try {
        const response = await fetch(`/api/user/${user.id}/profile`);
        const profileData = await response.json();
        
        document.getElementById('profile-name').innerText = profileData.username;
        document.getElementById('profile-bio').innerText = profileData.bio || "A passionate home cook and nutrition enthusiast who loves turning fresh, seasonal ingredients into meaningful meals.";
        
        // Update stats
        document.getElementById('count-recipes').innerText = profileData.stats.recipes;
        document.getElementById('count-favorites').innerText = profileData.stats.favorites;
        document.getElementById('tab-count-recipes').innerText = profileData.stats.recipes;
        document.getElementById('tab-count-favorites').innerText = profileData.stats.favorites;
        
        const followerEl = document.querySelector('.stat-item:nth-child(2) .stat-value');
        if (followerEl) followerEl.innerText = profileData.stats.followers;

        updateAvatars(profileData.profile_pic);
        
    } catch (err) {
        console.error("Error loading profile:", err);
        updateAvatars(null);
    }

    const grid = document.getElementById('profile-recipe-grid');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const contentTitle = document.getElementById('content-title');

    let myRecipes = [];
    let favRecipes = [];

    async function fetchData() {
        try {
            const [res1, res2] = await Promise.all([
                fetch(`/api/user/${user.id}/recipes`),
                fetch(`/api/user/${user.id}/favorites`)
            ]);
            myRecipes = await res1.json();
            favRecipes = await res2.json();

            // Initial render (default tab is recipes)
            renderRecipes('recipes');
        } catch (err) {
            console.error("Failed to fetch profile data:", err);
        }
    }

    function renderRecipes(tab) {
        const recipes = tab === 'recipes' ? myRecipes : favRecipes;
        contentTitle.innerText = tab === 'recipes' ? "DISCOVER RECIPES MADE BY YOU" : "THE DISHES YOU LOVE, SAVED JUST FOR YOU";
        
        if (recipes.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; padding: 5rem; text-align: center; color: #999; font-size: 1.1rem; background: #F9F9F9; border-radius: 20px;">
                <i class="fas fa-utensils" style="font-size: 3rem; margin-bottom: 1rem; display: block; opacity: 0.3;"></i>
                No recipes found in this section yet.
            </div>`;
            return;
        }

        grid.innerHTML = recipes.map(r => `
            <div class="recipe-card">
                <div class="recipe-img">
                    <img src="${r.img_src || 'images/recipe_placeholder.jpg'}" alt="${r.recipe_name}">
                </div>
                <div class="recipe-content">
                    <h3>${r.recipe_name}</h3>
                    <p>${r.ingredients || ''}</p>
                    <div class="recipe-card-footer">
                        <div class="recipe-meta">
                            <div class="meta-item"><i class="fas fa-clock"></i> ${r.total_time || '20 MIN'}</div>
                            <div class="meta-item"><i class="fas fa-user-friends"></i> ${r.servings || '2'} SERVINGS</div>
                        </div>
                        <div class="fav-actions">
                            ${tab === 'recipes' ? `
                                <button class="card-edit-btn" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                                <button class="card-delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
                            ` : `
                                <i class="fas fa-heart heart-btn active" style="color: var(--primary);" data-id="${r.id}"></i>
                            `}
                            <button class="view-btn" onclick="window.location.href='view_recipe.html?id=${r.id}'">VIEW RECIPE</button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Handle favorite toggle from profile
        if (tab === 'favorites') {
            grid.querySelectorAll('.heart-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    const recipeId = btn.dataset.id;
                    const response = await fetch('/api/favorite/toggle', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: user.id, recipe_id: recipeId })
                    });
                    if (response.ok) {
                        fetchData(); // Refresh list
                    }
                };
            });
        }
    }

    tabBtns.forEach(btn => {
        btn.onclick = () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderRecipes(btn.dataset.tab);
        };
    });

    // Profile Dropdown Toggle
    const profileTrigger = document.getElementById('profile-trigger');
    const profileMenu = document.getElementById('profile-menu');
    
    if (profileTrigger && profileMenu) {
        profileTrigger.onclick = (e) => {
            e.stopPropagation();
            profileMenu.classList.toggle('show');
        };
        
        window.addEventListener('click', () => {
            profileMenu.classList.remove('show');
        });
    }

    fetchData();
});

// Global Logout for Profile Page
window.logout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
};
