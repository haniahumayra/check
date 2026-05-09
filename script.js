// Navbar Scroll Effect
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

// Authentication State Management
function checkAuth() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const body = document.body;
    
    const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

    if (isLoggedIn) {
        body.setAttribute('data-view', 'user');
        const navAvatar = document.getElementById('nav-avatar-img');
        if (navAvatar) {
            navAvatar.src = user.profile_pic || DEFAULT_AVATAR;
        }
    } else {
        body.setAttribute('data-view', 'guest');
    }
}

// Global State
let currentCategory = "All";
let currentSearch = "";
let currentPage = 1;
const itemsPerPage = 10;
let allRecipes = [];

// Elements
const recipeSearch = document.getElementById('recipe-search');
const recipeDisplay = document.getElementById('recipe-display');
const categoryPills = document.querySelectorAll('#category-pills .pill');
const paginationContainer = document.querySelector('.pagination');

// Rendering
function renderCard(r) {
    const time = r.time || (r.total_time ? r.total_time : '20 MIN');
    const servingsVal = parseInt(r.servings);
    const servingsText = isNaN(servingsVal) ? (r.servings || '2 SERVES') : `${servingsVal} ${servingsVal > 1 ? 'SERVES' : 'SERVE'}`;
    const image = r.image || r.img_src || 'https://images.unsplash.com/photo-1495195134817-aeb325a55b65?auto=format&fit=crop&w=600&q=80';
    const name = r.name || r.recipe_name;
    const desc = r.description || (r.ingredients && r.ingredients.length > 0 ? r.ingredients.join(', ').slice(0, 100) + '...' : "A delicious and simple dish that you'll absolutely love making and eating.");

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
                        <div class="meta-item"><i class="far fa-user"></i> ${servingsText.toUpperCase()}</div>
                    </div>
                    <div class="fav-actions">
                        <i class="far fa-heart heart-btn"></i>
                        <button class="view-btn" onclick="window.location.href='view_recipe.html?id=${r.id}'">View Recipe</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function fetchRecipes(query = "") {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    
    try {
        const response = await fetch(`/api/search?${params.toString()}`);
        allRecipes = await response.json();
        filterAndRender();
    } catch (err) {
        console.error("Failed to fetch recipes:", err);
    }
}

function filterAndRender() {
    let filtered = allRecipes;
    
    if (currentCategory !== "All") {
        filtered = allRecipes.filter(r => r.category === currentCategory);
    }
    
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = 1;
    
    const start = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(start, start + itemsPerPage);
    
    if (recipeDisplay) {
        recipeDisplay.innerHTML = paginated.map(r => renderCard(r)).join('');
    }
    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    if (!paginationContainer) return;
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let html = `<div class="page-btn" onclick="changePage(${currentPage - 1})"><i class="fas fa-chevron-left"></i></div>`;
    
    for (let i = 1; i <= totalPages; i++) {
        html += `<div class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</div>`;
    }
    
    html += `<div class="page-btn" onclick="changePage(${currentPage + 1})"><i class="fas fa-chevron-right"></i></div>`;
    
    paginationContainer.innerHTML = html;
}

window.changePage = (page) => {
    const filteredCount = allRecipes.filter(r => currentCategory === "All" || r.category === currentCategory).length;
    const totalPages = Math.ceil(filteredCount / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    filterAndRender();
    document.getElementById('recipes-section').scrollIntoView({ behavior: 'smooth' });
};

// Everyone Favorite Slider Logic
let featuredRecipes = [];
let currentSlide = 0;
const cardsPerView = 5;

function renderFavCard(r) {
    const time = r.total_time || '25 MIN';
    const servings = r.servings || '2 SERVES';
    const image = r.img_src || 'https://images.unsplash.com/photo-1495195134817-aeb325a55b65?auto=format&fit=crop&w=600&q=80';
    const name = r.recipe_name;
    const desc = r.ingredients ? r.ingredients.slice(0, 60) + '...' : "A highly-rated favorite from our collection.";

    return `
        <div class="fav-card">
            <div class="fav-img">
                <img src="${image}" alt="${name}">
            </div>
            <div class="fav-content">
                <h3>${name}</h3>
                <p>${desc}</p>
                <div class="fav-footer">
                    <div class="fav-meta">
                        <div class="meta-item"><i class="far fa-clock"></i> ${time}</div>
                        <div class="meta-item"><i class="far fa-user"></i> ${servings.toString().includes('SERVE') ? servings : servings + ' SERVES'}</div>
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

async function loadFeatured() {
    const favSlider = document.getElementById('fav-slider');
    if (!favSlider) return;

    try {
        const response = await fetch('/api/featured');
        featuredRecipes = await response.json();
        
        favSlider.innerHTML = featuredRecipes.map(r => renderFavCard(r)).join('');
        
        // Setup Controls
        const btnLeft = document.getElementById('slide-left');
        const btnRight = document.getElementById('slide-right');
        
        if (btnLeft && btnRight) {
            btnLeft.onclick = () => moveSlider(-1);
            btnRight.onclick = () => moveSlider(1);
        }
    } catch (err) {
        console.error("Failed to load featured recipes:", err);
    }
}

function moveSlider(dir) {
    const slider = document.getElementById('fav-slider');
    const maxSlides = featuredRecipes.length - cardsPerView;
    
    currentSlide += dir * cardsPerView;
    
    if (currentSlide < 0) currentSlide = 0;
    if (currentSlide > maxSlides) currentSlide = maxSlides;
    
    const offset = currentSlide * (100 / cardsPerView);
    slider.style.transform = `translateX(-${currentSlide * (100 / cardsPerView + 0.5)}%)`; 

}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    fetchRecipes();
    loadFeatured();
    
    // Search listener
    if (recipeSearch) {
        recipeSearch.addEventListener('input', (e) => {
            fetchRecipes(e.target.value);
        });
    }

    // Category pills
    categoryPills.forEach(pill => {
        pill.addEventListener('click', () => {
            categoryPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentCategory = pill.getAttribute('data-category');
            currentPage = 1;
            filterAndRender();
        });
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
});

// Logout
function logout() {
    localStorage.removeItem('isLoggedIn');
    window.location.reload();
}

// Heart Toggle
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('heart-btn')) {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            alert("Please login to favorite recipes!");
            window.location.href = 'login.html';
            return;
        }

        // Find the recipe ID from the context (e.g., from a data-id attribute or similar)
        // For simplicity, let's assume the view recipe page handles its own. 
        // In the grid, we might need to add data-id.
        const recipeId = e.target.closest('.recipe-card')?.querySelector('.view-btn')?.getAttribute('onclick')?.match(/id=(\d+)/)?.[1];
        
        if (recipeId) {
            const response = await fetch('/api/favorite/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, recipe_id: recipeId })
            });
            const data = await response.json();
            if (data.success) {
                e.target.classList.toggle('fas');
                e.target.classList.toggle('far');
                e.target.classList.toggle('active');
            }
        }
    }
});

// Logout Helper (for demo)
window.logout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
};
