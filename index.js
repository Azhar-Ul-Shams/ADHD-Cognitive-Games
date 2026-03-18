document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const readMoreBtn = document.getElementById('readMoreBtn');
    const beginTestBtn = document.getElementById('beginTestBtn');
    const aboutTestsSection = document.getElementById('aboutTests');
    
    // Initialize users array from localStorage or create empty array
    let users = JSON.parse(localStorage.getItem('users')) || [];
    
    // Smooth scroll to about section when "Read More" is clicked
    if (readMoreBtn && aboutTestsSection) {
        readMoreBtn.addEventListener('click', function(e) {
            e.preventDefault();
            aboutTestsSection.scrollIntoView({
                behavior: 'smooth'
            });
            
            // Add slight highlight to section
            aboutTestsSection.style.transition = 'background-color 0.5s ease';
            aboutTestsSection.style.backgroundColor = '#f0f8ff';
            
            // Remove highlight after 1.5 seconds
            setTimeout(() => {
                aboutTestsSection.style.backgroundColor = '';
            }, 1500);
        });
    }
    
    // Handle "Begin Tests" button click
    if (beginTestBtn) {
        beginTestBtn.addEventListener('click', function() {
            // Check if there's an existing user session
            const currentSession = sessionStorage.getItem('currentUser');
            
            if (currentSession) {
                // If session exists, go directly to test list
                window.location.href = 'test_list.html';
            } else {
                // If no session, go to test list (which will show user info form)
                window.location.href = 'test_list.html';
            }
        });
    }
    
    // Check for success message from test_list page
    const urlParams = new URLSearchParams(window.location.search);
    const userAdded = urlParams.get('userAdded');
    
    if (userAdded === 'true') {
        // Show success message if redirected from test_list with user added
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.textContent = 'User successfully registered!';
        successMessage.style.position = 'fixed';
        successMessage.style.top = '20px';
        successMessage.style.left = '50%';
        successMessage.style.transform = 'translateX(-50%)';
        successMessage.style.backgroundColor = '#4CAF50';
        successMessage.style.color = 'white';
        successMessage.style.padding = '15px';
        successMessage.style.borderRadius = '5px';
        successMessage.style.zIndex = '1000';
        successMessage.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        
        document.body.appendChild(successMessage);
        
        // Remove message after 3 seconds
        setTimeout(() => {
            successMessage.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(successMessage);
            }, 500);
        }, 3000);
        
        // Clean the URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Add animation to hero section
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.style.opacity = '0';
        hero.style.transform = 'translateY(20px)';
        hero.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        
        setTimeout(() => {
            hero.style.opacity = '1';
            hero.style.transform = 'translateY(0)';
        }, 100);
    }
    
    // Add hover effects to test cards
    const testCards = document.querySelectorAll('.test-card');
    testCards.forEach(card => {
        card.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
        
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px)';
            card.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        });
    });
    
    // Add footer year update
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
});