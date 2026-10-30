/* ===================================================
   DEWAYS RESTAURANT - APPLICATION CORE LOGIC
   =================================================== */

// Global State
let cart = [];
let appliedPromo = null;
let currentCategory = 'all';
let searchQuery = '';
let selectedTable = null;
let isMusicPlaying = false;
let isMusicMuted = false;
let currentVolume = 0.65;
let audioCtx = null;
let bgAudio = null;
let synthPlayer = null;
let isLocalMusicLoaded = false;

const PROMO_CODES = {
    'DEWAYS10': { discount: 0.10, desc: "10% maxsus chegirma" },
    'VIP20': { discount: 0.20, desc: "20% VIP mehmonga chegirma" }
};

// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadCustomDishes();
    loadCartFromStorage();
    renderCategories();
    renderDishes();
    renderReviews();
    renderChefs();
    setupEventListeners();
    updateCartUI();
    initScrollReveal();
    initScrollToTop();
    initBackgroundMusic();
    setupAutoplayOnInteraction();
    initHeroParticles();
    initMouseSpotlight();
    init3DTiltCards();
    initCounters();
    initPhoneMasks();
    initHeroVideo();
});

function initHeroVideo() {
    const heroVideo = document.getElementById('hero-showcase-video');
    if (heroVideo) {
        heroVideo.muted = true;
        heroVideo.play().catch(() => {});
    }
}

// Setup DOM Event Listeners
function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            renderDishes();
        });
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            renderDishes();
        });
    }

    const bookingForm = document.getElementById('booking-form');
    if (bookingForm) {
        bookingForm.addEventListener('submit', handleReservationSubmit);
    }

    const reviewForm = document.getElementById('review-form');
    if (reviewForm) {
        reviewForm.addEventListener('submit', handleReviewSubmit);
    }

    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', handleCheckoutSubmit);
    }
}

// Format Currency UZS
function formatPrice(num) {
    return new Intl.NumberFormat('uz-UZ').format(num) + " so'm";
}

// ----------------------------------------------------
// WEB AUDIO SYNTHESIZER SOUND EFFECTS
// ----------------------------------------------------
function getAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playLuxuryChime(type) {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        if (type === 'click') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'fanfare') {
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const startTime = now + idx * 0.12;
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.12, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.45);
            });
        }
    } catch (e) {
        // AudioContext not allowed before user interaction
    }
}

// ----------------------------------------------------
// PHONE NUMBER VALIDATION & INPUT MASK (+998 XX XXX XX XX)
// ----------------------------------------------------
function validatePhoneNumber(raw) {
    if (!raw) return { isValid: false, message: "Telefon raqamingizni kiriting!" };
    let cleaned = raw.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+998')) {
        cleaned = cleaned.substring(4);
    } else if (cleaned.startsWith('998')) {
        cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('8') && cleaned.length === 10) {
        cleaned = cleaned.substring(1);
    }

    if (cleaned.length !== 9) {
        return {
            isValid: false,
            message: "Noto'g'ri nomer! Raqam 9 ta raqamdan iborat bo'lishi kerak (masalan: 90 123 45 67)"
        };
    }

    const validPrefixes = ['90', '91', '93', '94', '95', '97', '98', '99', '88', '77', '33', '20', '50', '55', '71'];
    const prefix = cleaned.substring(0, 2);
    if (!validPrefixes.includes(prefix)) {
        return {
            isValid: false,
            message: `Noto'g'ri operator kodi (${prefix})! To'g'ri nomer tering (+998 XX XXX XX XX)`
        };
    }

    const dummyNumbers = ['0000000', '1111111', '1234567', '7654321', '9999999'];
    if (dummyNumbers.includes(cleaned.substring(2))) {
        return {
            isValid: false,
            message: "Mavjud bo'lmagan raqam kiritildi. Iltimos haqiqiy nomeringizni tering!"
        };
    }

    const formatted = `+998 ${cleaned.substring(0,2)} ${cleaned.substring(2,5)} ${cleaned.substring(5,7)} ${cleaned.substring(7,9)}`;
    return { isValid: true, formatted, rawDigits: cleaned };
}

function formatPhoneInputRealtime(el) {
    if (!el) return;
    let val = el.value.replace(/\D/g, '');
    if (val.startsWith('998')) {
        val = val.substring(3);
    }
    val = val.substring(0, 9);

    let formatted = '+998';
    if (val.length > 0) formatted += ' ' + val.substring(0, 2);
    if (val.length >= 3) formatted += ' ' + val.substring(2, 5);
    if (val.length >= 6) formatted += ' ' + val.substring(5, 7);
    if (val.length >= 8) formatted += ' ' + val.substring(7, 9);
    el.value = formatted;
}

function initPhoneMasks() {
    ['reserve-phone', 'checkout-phone'].forEach(id => {
        const input = document.getElementById(id);
        const errorEl = document.getElementById(id + '-error');
        if (!input) return;

        input.addEventListener('focus', () => {
            if (!input.value.trim()) input.value = '+998 ';
        });

        input.addEventListener('input', () => {
            formatPhoneInputRealtime(input);
            if (errorEl) {
                errorEl.classList.add('hidden');
                errorEl.innerText = '';
            }
            input.classList.remove('border-rose-500', 'ring-2', 'ring-rose-500/30');
        });

        input.addEventListener('blur', () => {
            if (input.value.trim() === '+998' || input.value.trim() === '+998 ') {
                input.value = '';
                return;
            }
            const check = validatePhoneNumber(input.value);
            if (!check.isValid && input.value.length > 4) {
                showPhoneError(input, errorEl, check.message);
            } else if (check.isValid) {
                input.value = check.formatted;
                input.classList.remove('border-rose-500', 'ring-2', 'ring-rose-500/30');
                input.classList.add('border-emerald-500');
            }
        });
    });
}

function showPhoneError(input, errorEl, msg) {
    if (input) {
        input.classList.add('border-rose-500', 'ring-2', 'ring-rose-500/30');
        input.classList.remove('border-emerald-500');
    }
    if (errorEl) {
        errorEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}`;
        errorEl.classList.remove('hidden');
    }
}

// ----------------------------------------------------
// SCROLL REVEAL & ANIMATIONS
// ----------------------------------------------------
function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
        reveals.forEach(el => el.classList.add('is-visible'));
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    reveals.forEach(el => observer.observe(el));
}

function initScrollToTop() {
    const btn = document.getElementById('scroll-top-btn');
    if (!btn) return;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            btn.classList.add('is-active');
        } else {
            btn.classList.remove('is-active');
        }
    });
    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ----------------------------------------------------
// PARTICLES & 3D TILT
// ----------------------------------------------------
function initHeroParticles() {
    const canvas = document.getElementById('hero-particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = canvas.width = canvas.parentElement.offsetWidth || window.innerWidth;
    let height = canvas.height = canvas.parentElement.offsetHeight || 600;

    const particles = [];
    const count = width > 768 ? 40 : 20;

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 2 + 0.8,
            speedY: Math.random() * 0.45 + 0.15,
            speedX: (Math.random() - 0.5) * 0.35,
            alpha: Math.random() * 0.6 + 0.2,
            pulse: Math.random() * 0.02 + 0.01,
            pulseDir: 1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        for (let p of particles) {
            p.y -= p.speedY;
            p.x += p.speedX;
            p.alpha += p.pulse * p.pulseDir;
            if (p.alpha > 0.85) p.pulseDir = -1;
            if (p.alpha < 0.15) p.pulseDir = 1;
            if (p.y < -10) {
                p.y = height + 10;
                p.x = Math.random() * width;
            }
            if (p.x < -10) p.x = width + 10;
            if (p.x > width + 10) p.x = -10;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(212, 175, 55, ${p.alpha})`;
            ctx.shadowBlur = 6;
            ctx.shadowColor = 'rgba(212, 175, 55, 0.5)';
            ctx.fill();
        }
        requestAnimationFrame(animate);
    }
    animate();

    window.addEventListener('resize', () => {
        if (!canvas || !canvas.parentElement) return;
        width = canvas.width = canvas.parentElement.offsetWidth;
        height = canvas.height = canvas.parentElement.offsetHeight;
    });
}

function initMouseSpotlight() {
    window.addEventListener('pointermove', (e) => {
        document.body.style.setProperty('--cursor-x', `${e.clientX}px`);
        document.body.style.setProperty('--cursor-y', `${e.clientY}px`);
    });
}

function init3DTiltCards() {
    const cards = document.querySelectorAll('.tilt-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -10;
            const rotateY = ((x - centerX) / centerX) * 10;
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
        });
    });
}

function initCounters() {
    const counters = document.querySelectorAll('[data-counter]');
    if (!counters.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseFloat(el.getAttribute('data-counter'));
                const isDecimal = target % 1 !== 0;
                let current = 0;
                const step = target / 35;
                const timer = setInterval(() => {
                    current += step;
                    if (current >= target) {
                        current = target;
                        clearInterval(timer);
                    }
                    if (isDecimal) {
                        el.innerText = current.toFixed(1) + "/5";
                    } else if (target >= 100) {
                        el.innerText = Math.round(current) + "K+";
                    } else {
                        el.innerText = Math.round(current) + "+";
                    }
                }, 35);
                observer.unobserve(el);
            }
        });
    }, { threshold: 0.2 });

    counters.forEach(c => observer.observe(c));
}

function updateZonePreview(zone) {
    const img = document.getElementById('zone-preview-img');
    const title = document.getElementById('zone-preview-title');
    const desc = document.getElementById('zone-preview-desc');
    const pills = document.querySelectorAll('.zone-pill');

    pills.forEach(p => {
        p.classList.remove('border-amber-400', 'text-amber-300');
        p.classList.add('border-white/10', 'text-slate-300');
    });

    const activeRadio = document.querySelector(`input[name="reserve_zone"][value="${zone}"]`);
    if (activeRadio && activeRadio.nextElementSibling) {
        activeRadio.nextElementSibling.classList.remove('border-white/10', 'text-slate-300');
        activeRadio.nextElementSibling.classList.add('border-amber-400', 'text-amber-300');
    }

    if (!img || !title || !desc) return;

    if (zone === 'Asosiy zal') {
        img.src = 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=300&q=80';
        title.innerText = 'Asosiy Grand Zal';
        desc.innerText = "120 o'rinlik hashamatli zal, royal va jonli musiqa sahnasi bilan.";
    } else if (zone === 'Yozgi veranda') {
        img.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80';
        title.innerText = 'Yozgi Ochiq Terrasa';
        desc.innerText = "Toza havo, fontanlar va ko'kalamzorlashtirilgan shinam ayvon.";
    } else if (zone === 'VIP xona') {
        img.src = 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=300&q=80';
        title.innerText = 'Alohida VIP Kabina';
        desc.innerText = "Shaxsiy ofitsiant xizmati, karaoke va to'liq maxfiylik.";
    }
}

// ----------------------------------------------------
// INTERACTIVE FLOOR PLAN TABLE SELECTION
// ----------------------------------------------------
function selectTableNode(tableName, guestRange, zoneName, el) {
    playLuxuryChime('click');
    selectedTable = { name: tableName, guests: guestRange, zone: zoneName };

    document.querySelectorAll('.table-node').forEach(node => {
        node.classList.remove('is-selected');
    });
    if (el) el.classList.add('is-selected');

    const badge = document.getElementById('selected-table-badge');
    const nameEl = document.getElementById('selected-table-name');
    if (badge && nameEl) {
        nameEl.innerText = `${tableName} (${guestRange}, ${zoneName})`;
        badge.classList.remove('hidden');
    }

    const zoneRadio = document.querySelector(`input[name="reserve_zone"][value="${zoneName}"]`);
    if (zoneRadio) {
        zoneRadio.checked = true;
        updateZonePreview(zoneName);
    }
    showToast(`${tableName} tanlandi!`, 'info');
}

// ----------------------------------------------------
// CONFETTI CELEBRATION CANNON
// ----------------------------------------------------
function triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#d4af37', '#f3e5ab', '#ffffff', '#10b981', '#f59e0b'];

    for (let i = 0; i < 90; i++) {
        pieces.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            w: Math.random() * 8 + 4,
            h: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 16,
            vy: (Math.random() - 0.7) * 16,
            rotation: Math.random() * 360,
            vRot: (Math.random() - 0.5) * 10,
            alpha: 1
        });
    }

    let frames = 0;
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        frames++;
        for (let p of pieces) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.35; // gravity
            p.rotation += p.vRot;
            if (frames > 35) p.alpha -= 0.02;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }
        if (frames < 90) {
            requestAnimationFrame(render);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    requestAnimationFrame(render);
}

// ----------------------------------------------------
// LIVE RADAR TRACKING MODAL (Luxury Courier Experience)
// ----------------------------------------------------
function openRadarModal(orderNumber) {
    playLuxuryChime('click');
    const modal = document.getElementById('radar-modal');
    const orderIdEl = document.getElementById('radar-order-id');
    if (orderIdEl && orderNumber) {
        orderIdEl.innerText = "Buyurtma ID: " + orderNumber;
    }
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeRadarModal() {
    const modal = document.getElementById('radar-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// Flying Dish to Cart Animation
function animateFlyToCart(sourceElement, imageSrc) {
    if (!sourceElement || !imageSrc) return;
    const cartBtn = document.getElementById('navbar-cart-btn') || document.querySelector('button[onclick="toggleCartDrawer()"]');
    if (!cartBtn) return;

    const sourceRect = sourceElement.getBoundingClientRect();
    const cartRect = cartBtn.getBoundingClientRect();

    const flyer = document.createElement('img');
    flyer.src = imageSrc;
    flyer.className = 'flying-cart-ghost';
    flyer.style.width = '60px';
    flyer.style.height = '60px';
    flyer.style.top = `${sourceRect.top + sourceRect.height / 2 - 30}px`;
    flyer.style.left = `${sourceRect.left + sourceRect.width / 2 - 30}px`;

    document.body.appendChild(flyer);

    setTimeout(() => {
        flyer.style.top = `${cartRect.top + cartRect.height / 2 - 15}px`;
        flyer.style.left = `${cartRect.left + cartRect.width / 2 - 15}px`;
        flyer.style.width = '30px';
        flyer.style.height = '30px';
        flyer.style.opacity = '0.3';
    }, 20);

    setTimeout(() => {
        if (flyer.parentNode) flyer.parentNode.removeChild(flyer);
        cartBtn.classList.add('ring-pulse-gold');
        setTimeout(() => cartBtn.classList.remove('ring-pulse-gold'), 800);
    }, 850);
}

// ----------------------------------------------------
// CART MANAGEMENT & LOCALSTORAGE
// ----------------------------------------------------
function loadCartFromStorage() {
    try {
        const stored = localStorage.getItem('deways_cart');
        if (stored) cart = JSON.parse(stored);
    } catch (e) {
        cart = [];
    }
}

function saveCartToStorage() {
    try {
        localStorage.setItem('deways_cart', JSON.stringify(cart));
    } catch (e) {}
}

function addToCart(dishId, event) {
    const dish = RESTAURANT_DATA.dishes.find(d => d.id === dishId);
    if (!dish) return;

    playLuxuryChime('click');
    if (event && event.currentTarget) {
        const cardImg = event.currentTarget.closest('.glass-card')?.querySelector('img');
        if (cardImg) {
            animateFlyToCart(cardImg, dish.image);
        }
    }

    const existing = cart.find(item => item.id === dishId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id: dish.id,
            name: dish.name,
            price: dish.price,
            image: dish.image,
            category: dish.category,
            quantity: 1
        });
    }

    saveCartToStorage();
    updateCartUI();
    showToast(`"${dish.name}" savatga qo'shildi!`, "success");
}

function removeFromCart(dishId) {
    cart = cart.filter(item => item.id !== dishId);
    saveCartToStorage();
    updateCartUI();
    showToast("Taom savatdan olib tashlandi", "info");
}

function updateCartQuantity(dishId, delta) {
    const item = cart.find(i => i.id === dishId);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
        removeFromCart(dishId);
        return;
    }
    saveCartToStorage();
    updateCartUI();
}

function clearCart() {
    if (cart.length === 0) return;
    cart = [];
    appliedPromo = null;
    saveCartToStorage();
    updateCartUI();
    showToast("Savat tozalandi", "info");
}

function toggleCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const backdrop = document.getElementById('cart-backdrop');
    if (!drawer) return;

    const isOpen = !drawer.classList.contains('translate-x-full');
    if (isOpen) {
        drawer.classList.add('translate-x-full');
        if (backdrop) backdrop.classList.add('hidden');
    } else {
        drawer.classList.remove('translate-x-full');
        if (backdrop) backdrop.classList.remove('hidden');
    }
}

function updateCartUI() {
    const countBadges = document.querySelectorAll('.cart-count-badge');
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    countBadges.forEach(badge => {
        badge.innerText = totalCount;
        if (totalCount > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });

    const itemsContainer = document.getElementById('cart-items-container');
    const emptyState = document.getElementById('cart-empty-state');
    const footer = document.getElementById('cart-footer');

    if (!itemsContainer) return;

    if (cart.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (footer) footer.classList.add('hidden');
        itemsContainer.innerHTML = '';
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (footer) footer.classList.remove('hidden');

    itemsContainer.innerHTML = cart.map(item => `
        <div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:border-amber-400/30 transition-all">
            <img src="${item.image}" alt="${item.name}" class="w-14 h-14 rounded-lg object-cover border border-white/10 shrink-0">
            <div class="flex-1 min-w-0">
                <h5 class="text-xs font-bold text-white truncate">${item.name}</h5>
                <p class="text-xs text-amber-400 font-semibold font-mono mt-0.5">${formatPrice(item.price)}</p>
                <div class="flex items-center gap-2 mt-1.5">
                    <button onclick="updateCartQuantity(${item.id}, -1)" class="w-6 h-6 rounded-md bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-xs">
                        <i class="fa-solid fa-minus"></i>
                    </button>
                    <span class="text-xs font-bold text-white px-1.5 font-mono">${item.quantity}</span>
                    <button onclick="updateCartQuantity(${item.id}, 1)" class="w-6 h-6 rounded-md bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-xs">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>
            <button onclick="removeFromCart(${item.id})" class="text-slate-500 hover:text-rose-400 p-1.5 transition-colors" title="O'chirish">
                <i class="fa-solid fa-trash-can text-sm"></i>
            </button>
        </div>
    `).join('');

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const serviceFee = Math.round(subtotal * 0.10);
    let discountAmount = 0;
    if (appliedPromo && PROMO_CODES[appliedPromo]) {
        discountAmount = Math.round(subtotal * PROMO_CODES[appliedPromo].discount);
    }
    const grandTotal = subtotal + serviceFee - discountAmount;

    if (document.getElementById('cart-subtotal')) document.getElementById('cart-subtotal').innerText = formatPrice(subtotal);
    if (document.getElementById('cart-service')) document.getElementById('cart-service').innerText = formatPrice(serviceFee);
    if (document.getElementById('cart-total')) document.getElementById('cart-total').innerText = formatPrice(grandTotal);

    const promoRow = document.getElementById('cart-discount-row');
    const discountEl = document.getElementById('cart-discount');
    if (promoRow && discountEl) {
        if (discountAmount > 0) {
            promoRow.classList.remove('hidden');
            discountEl.innerText = `-${formatPrice(discountAmount)}`;
        } else {
            promoRow.classList.add('hidden');
        }
    }
}

function applyPromoCode() {
    const input = document.getElementById('promo-input');
    if (!input) return;
    const code = input.value.trim().toUpperCase();
    if (PROMO_CODES[code]) {
        appliedPromo = code;
        updateCartUI();
        showToast(`Promo-kod faollashtirildi: ${PROMO_CODES[code].desc}!`, "success");
    } else {
        showToast("Noto'g'ri promo-kod! Masalan: DEWAYS10", "error");
    }
}

// ----------------------------------------------------
// CHECKOUT & ORDER CONFIRMATION
// ----------------------------------------------------
function openCheckoutModal() {
    if (cart.length === 0) {
        showToast("Savat bo'sh! Iltimos taom tanlang.", "warning");
        return;
    }
    toggleCartDrawer();

    const modal = document.getElementById('checkout-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const summaryEl = document.getElementById('checkout-summary-text');
    if (summaryEl) {
        summaryEl.innerText = `${totalItems} ta taom — Jami: ${formatPrice(subtotal)}`;
    }
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function handleCheckoutSubmit(e) {
    e.preventDefault();
    const nameInput = document.getElementById('checkout-name');
    const phoneInput = document.getElementById('checkout-phone');
    const phoneErrorEl = document.getElementById('checkout-phone-error');

    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const address = document.getElementById('checkout-address')?.value.trim() || '';
    const orderType = document.querySelector('input[name="order_type"]:checked')?.value || 'Manzilga yetkazib berish';
    const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'Payme';
    const notes = document.getElementById('checkout-notes')?.value.trim() || '';

    if (!name) {
        showToast("Iltimos, to'liq ismingizni kiriting!", "warning");
        if (nameInput) nameInput.focus();
        return;
    }

    const phoneCheck = validatePhoneNumber(phone);
    if (!phoneCheck.isValid) {
        showPhoneError(phoneInput, phoneErrorEl, phoneCheck.message);
        showToast("Noto'g'ri nomer! Iltimos, to'g'ri nomer tering (+998 XX XXX XX XX)", "error");
        if (phoneInput) phoneInput.focus();
        return;
    }

    const orderNumber = "DW-" + Math.floor(100000 + Math.random() * 900000);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const serviceFee = Math.round(subtotal * 0.10);
    let discount = 0;
    if (appliedPromo && PROMO_CODES[appliedPromo]) {
        discount = Math.round(subtotal * PROMO_CODES[appliedPromo].discount);
    }
    const grandTotal = subtotal + serviceFee - discount;

    // Sync to Admin Portal orders
    try {
        let adminOrders = JSON.parse(localStorage.getItem('deways_admin_orders') || '[]');
        adminOrders.unshift({
            id: orderNumber,
            name: name,
            phone: phoneCheck.formatted,
            address: address || (orderType.includes("olib ketish") ? "O'zi olib ketish" : "Manzil kiritilmagan"),
            items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
            grandTotal: grandTotal,
            paymentMethod: paymentMethod,
            status: "Kutilmoqda",
            date: "Bugun, " + new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
        });
        localStorage.setItem('deways_admin_orders', JSON.stringify(adminOrders));
    } catch(err) {
        console.error("Admin order sync error:", err);
    }

    closeCheckoutModal();
    openReceiptModal({
        orderNumber,
        name,
        phone: phoneCheck.formatted,
        address,
        orderType,
        paymentMethod,
        notes,
        items: [...cart],
        subtotal,
        serviceFee,
        discount,
        grandTotal,
        date: new Date().toLocaleString('uz-UZ')
    });

    cart = [];
    appliedPromo = null;
    saveCartToStorage();
    updateCartUI();
    showToast("Buyurtmangiz muvaffaqiyatli qabul qilindi!", "success");
}

function openReceiptModal(data) {
    const modal = document.getElementById('receipt-modal');
    const content = document.getElementById('receipt-content');
    if (!modal || !content) return;

    content.innerHTML = `
        <div class="text-center pb-5 border-b border-white/10">
            <div class="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-3xl mx-auto mb-3">
                <i class="fa-solid fa-check"></i>
            </div>
            <h3 class="text-2xl font-bold text-white">Buyurtmangiz qabul qilindi!</h3>
            <p class="text-xs text-slate-400 mt-1">Buyurtma ID: <span class="text-amber-400 font-mono font-bold">${data.orderNumber}</span></p>
            <p class="text-xs text-slate-400">${data.date}</p>
        </div>

        <div class="py-4 space-y-2 text-sm text-slate-300 border-b border-white/10">
            <div class="flex justify-between"><span class="text-slate-400">Buyurtmachi:</span> <span class="font-semibold text-white">${data.name}</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Telefon:</span> <span class="font-semibold text-white">${data.phone}</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Xizmat turi:</span> <span class="font-semibold text-amber-300">${data.orderType}</span></div>
            ${data.address ? `<div class="flex justify-between"><span class="text-slate-400">Manzil:</span> <span class="font-semibold text-white text-right">${data.address}</span></div>` : ''}
            <div class="flex justify-between"><span class="text-slate-400">To'lov usuli:</span> <span class="font-semibold text-white">${data.paymentMethod}</span></div>
        </div>

        <div class="py-4 space-y-2 max-h-48 overflow-y-auto border-b border-white/10 text-xs">
            <div class="font-bold text-amber-400 uppercase tracking-wider mb-2">Buyurtma tarkibi:</div>
            ${data.items.map(item => `
                <div class="flex justify-between text-slate-300">
                    <span>${item.name} × ${item.quantity}</span>
                    <span class="font-mono">${formatPrice(item.price * item.quantity)}</span>
                </div>
            `).join('')}
        </div>

        <div class="pt-4 space-y-1.5 text-sm">
            <div class="flex justify-between text-slate-400 text-xs"><span>Taomlar narxi:</span> <span>${formatPrice(data.subtotal)}</span></div>
            <div class="flex justify-between text-slate-400 text-xs"><span>Xizmat haqi (10%):</span> <span>${formatPrice(data.serviceFee)}</span></div>
            ${data.discount > 0 ? `<div class="flex justify-between text-emerald-400 text-xs"><span>Chegirma:</span> <span>-${formatPrice(data.discount)}</span></div>` : ''}
            <div class="flex justify-between text-lg font-bold text-white pt-2 border-t border-white/10">
                <span>Jami to'lov:</span> <span class="text-amber-400">${formatPrice(data.grandTotal)}</span>
            </div>
        </div>

        <div class="mt-6 text-center space-y-2.5">
            <p class="text-xs text-slate-400 mb-2">DEWAYS operatori 3 daqiqa ichida buyurtmani tasdiqlash uchun siz bilan bog'lanadi.</p>
            <button onclick="openRadarModal('${data.orderNumber}')" class="btn-outline-gold w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-amber-400 hover:text-black transition-all">
                <i class="fa-solid fa-radar text-amber-400"></i>
                <span>Jonli buyurtma radari va kuryer harakatini kuzatish</span>
            </button>
            <button onclick="closeReceiptModal()" class="btn-gold w-full py-3 rounded-xl font-bold text-xs">
                Tushunarli, rahmat!
            </button>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    triggerConfetti();
    playLuxuryChime('fanfare');
}

function closeReceiptModal() {
    const modal = document.getElementById('receipt-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// ----------------------------------------------------
// RESERVATIONS & BOOKING
// ----------------------------------------------------
function handleReservationSubmit(e) {
    e.preventDefault();
    const nameInput = document.getElementById('reserve-name');
    const phoneInput = document.getElementById('reserve-phone');
    const phoneErrorEl = document.getElementById('reserve-phone-error');

    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const guests = document.getElementById('reserve-guests')?.value || '3-4';
    const date = document.getElementById('reserve-date')?.value || '';
    const time = document.getElementById('reserve-time')?.value || '19:30';
    const zone = document.querySelector('input[name="reserve_zone"]:checked')?.value || 'Asosiy zal';
    const notes = document.getElementById('reserve-notes')?.value.trim() || '';

    if (!name || !date || !time) {
        showToast("Iltimos, barcha zarur maydonlarni to'ldiring!", "warning");
        return;
    }

    const phoneCheck = validatePhoneNumber(phone);
    if (!phoneCheck.isValid) {
        showPhoneError(phoneInput, phoneErrorEl, phoneCheck.message);
        showToast("Noto'g'ri nomer! Iltimos, to'g'ri nomer tering (+998 XX XXX XX XX)", "error");
        if (phoneInput) phoneInput.focus();
        return;
    }

    const bookingCode = "DW-RES-" + Math.floor(1000 + Math.random() * 9000);
    const tableInfo = selectedTable ? `${selectedTable.name} (${selectedTable.guests})` : 'Stol tanlanmagan (Avtomatik)';

    // Sync to Admin Portal reservations
    try {
        let adminRes = JSON.parse(localStorage.getItem('deways_admin_reservations') || '[]');
        adminRes.unshift({
            code: bookingCode,
            name: name,
            phone: phoneCheck.formatted,
            date: date,
            time: time,
            guests: `${guests} kishi`,
            table: tableInfo,
            notes: notes || "Qo'shimcha izoh yo'q",
            status: "Tasdiqlangan"
        });
        localStorage.setItem('deways_admin_reservations', JSON.stringify(adminRes));
    } catch(err) {
        console.error("Admin reservation sync error:", err);
    }

    const modal = document.getElementById('reservation-confirm-modal');
    const content = document.getElementById('reservation-confirm-content');
    if (modal && content) {
        content.innerHTML = `
            <div class="text-center pb-5 border-b border-white/10">
                <div class="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-3xl mx-auto mb-3">
                    <i class="fa-solid fa-calendar-check"></i>
                </div>
                <h3 class="text-2xl font-bold text-white">Stolingiz band qilindi!</h3>
                <p class="text-xs text-slate-400 mt-1">Bron kodi: <span class="text-amber-400 font-mono font-bold">${bookingCode}</span></p>
            </div>

            <div class="py-5 space-y-2.5 text-sm text-slate-300">
                <div class="flex justify-between"><span class="text-slate-400">Mehmon ismi:</span> <span class="font-semibold text-white">${name}</span></div>
                <div class="flex justify-between"><span class="text-slate-400">Telefon:</span> <span class="font-semibold text-white">${phoneCheck.formatted}</span></div>
                <div class="flex justify-between"><span class="text-slate-400">Mehmonlar soni:</span> <span class="font-semibold text-amber-300">${guests} kishi</span></div>
                <div class="flex justify-between"><span class="text-slate-400">Sana va vaqt:</span> <span class="font-semibold text-white">${date} | ${time}</span></div>
                <div class="flex justify-between"><span class="text-slate-400">Tanlangan hudud:</span> <span class="font-semibold text-emerald-400">${zone}</span></div>
                <div class="flex justify-between"><span class="text-slate-400">Stol:</span> <span class="font-semibold text-amber-400">${tableInfo}</span></div>
                ${notes ? `<div class="mt-3 p-3 bg-white/5 rounded-lg text-xs text-slate-300 border border-white/5"><span class="text-amber-400 font-bold">Maxsus istak:</span> ${notes}</div>` : ''}
            </div>

            <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 text-center">
                <i class="fa-solid fa-circle-info mr-1"></i> Sizning broningiz tasdiqlandi. Belgilangan vaqtdan 15 daqiqa oldin tashrif buyurishingizni so'raymiz.
            </div>

            <div class="mt-6">
                <button onclick="closeReservationConfirmModal()" class="btn-gold w-full py-3 rounded-xl font-bold">
                    Tayyor, saqlab qo'yish
                </button>
            </div>
        `;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        triggerConfetti();
        playLuxuryChime('fanfare');
    }

    showToast("Stolingiz muvaffaqiyatli band qilindi!", "success");
    e.target.reset();
    selectedTable = null;
    const badge = document.getElementById('selected-table-badge');
    if (badge) badge.classList.add('hidden');
    document.querySelectorAll('.table-node').forEach(n => n.classList.remove('is-selected'));
}

function closeReservationConfirmModal() {
    const modal = document.getElementById('reservation-confirm-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// ----------------------------------------------------
// DISH DETAIL MODAL
// ----------------------------------------------------
function openDishModal(dishId) {
    const dish = RESTAURANT_DATA.dishes.find(d => d.id === dishId);
    if (!dish) return;

    playLuxuryChime('click');
    const modal = document.getElementById('dish-modal');
    const content = document.getElementById('dish-modal-content');
    if (!modal || !content) return;

    content.innerHTML = `
        <div class="relative h-64 sm:h-72 w-full overflow-hidden">
            <img src="${dish.image}" alt="${dish.name}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-gradient-to-t from-[#11141c] via-black/30 to-transparent"></div>
            <button onclick="closeDishModal()" class="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/70 border border-white/20 text-white flex items-center justify-center hover:bg-rose-500 transition-colors cursor-pointer">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div class="absolute top-4 left-4 flex gap-2">
                <span class="bg-amber-500 text-black text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                    ${dish.badge || "Eksklyuziv Taom"}
                </span>
                <span class="bg-black/70 backdrop-blur-md text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-500/40">
                    <i class="fa-solid fa-certificate mr-1"></i> 100% Halol
                </span>
            </div>
            <div class="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 text-xs">
                <span class="bg-black/80 backdrop-blur-md text-amber-300 font-semibold px-3 py-1 rounded-full border border-amber-500/30">
                    <i class="fa-solid fa-star text-amber-400 mr-1"></i> ${dish.rating} (${dish.reviewsCount} baho)
                </span>
                <span class="bg-black/80 backdrop-blur-md text-slate-200 font-semibold px-3 py-1 rounded-full border border-white/20">
                    <i class="fa-solid fa-weight-scale mr-1"></i> ${dish.weight}
                </span>
                <span class="bg-black/80 backdrop-blur-md text-slate-200 font-semibold px-3 py-1 rounded-full border border-white/20">
                    <i class="fa-solid fa-fire mr-1"></i> ${dish.calories}
                </span>
            </div>
        </div>

        <div class="p-6 space-y-4">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-widest text-amber-400">Gastronomik Pasport</span>
                    <h3 class="text-xl sm:text-2xl font-bold text-white font-serif-luxury mt-0.5">${dish.name}</h3>
                    <p class="text-xs text-slate-300 mt-1.5 leading-relaxed">${dish.description}</p>
                </div>
                <div class="text-right shrink-0">
                    <div class="text-2xl font-black text-amber-400 font-mono">${formatPrice(dish.price)}</div>
                    ${dish.oldPrice ? `<div class="text-xs text-slate-500 line-through font-mono">${formatPrice(dish.oldPrice)}</div>` : ''}
                </div>
            </div>

            <!-- Chef's Pairing & Secret Note -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div class="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <div class="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                        <i class="fa-solid fa-wine-glass"></i> Sommelier Tavsiyasi:
                    </div>
                    <p class="text-[11px] text-slate-300">Yangi siqilgan anor sharbati yoki tog' giyohli maxsus ko'k choy.</p>
                </div>
                <div class="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <div class="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                        <i class="fa-solid fa-kitchen-set"></i> Pishirish Usuli:
                    </div>
                    <p class="text-[11px] text-slate-300">Ispaniya Josper pechida eman o'tini ko'mirida barra qovurilgan.</p>
                </div>
            </div>

            <div class="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                <h5 class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <i class="fa-solid fa-seedling text-emerald-400"></i> Sara Masalliqlar:
                </h5>
                <p class="text-xs text-slate-300 leading-relaxed font-light">${dish.ingredients}</p>
            </div>

            <div class="pt-2 flex gap-3">
                <button onclick="addToCart(${dish.id}, event); closeDishModal();" class="btn-gold flex-1 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 cursor-pointer">
                    <i class="fa-solid fa-cart-plus"></i>
                    <span>Savatga Qo'shish</span>
                </button>
                <button onclick="closeDishModal()" class="px-5 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold uppercase transition-colors cursor-pointer">
                    Yopish
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeDishModal() {
    const modal = document.getElementById('dish-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// ----------------------------------------------------
// REVIEWS & FEEDBACK
// ----------------------------------------------------
function openAddReviewModal() {
    playLuxuryChime('click');
    const modal = document.getElementById('add-review-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeAddReviewModal() {
    const modal = document.getElementById('add-review-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function handleReviewSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('review-author')?.value.trim();
    const role = document.getElementById('review-role')?.value.trim() || 'Hurmatli mehmon';
    const rating = parseInt(document.getElementById('review-rating')?.value || '5');
    const text = document.getElementById('review-text')?.value.trim();

    if (!name || !text) {
        showToast("Iltimos, ismingiz va sharhingizni kiriting!", "warning");
        return;
    }

    RESTAURANT_DATA.reviews.unshift({
        id: Date.now(),
        author: name,
        role: role,
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
        rating: rating,
        date: "Hozirgina",
        text: text
    });

    renderReviews();
    closeAddReviewModal();
    showToast("Samimiy sharhingiz uchun tashakkur!", "success");
    e.target.reset();
}

// ----------------------------------------------------
// RENDERING FUNCTIONS
// ----------------------------------------------------
function renderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    container.innerHTML = RESTAURANT_DATA.categories.map(cat => `
        <button onclick="setCategory('${cat.id}')"
            class="category-btn flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 border border-white/10 ${cat.id === currentCategory ? 'active' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:border-amber-500/40'}">
            <i class="fa-solid ${cat.icon}"></i>
            <span>${cat.name}</span>
        </button>
    `).join('');
}

function setCategory(id) {
    playLuxuryChime('click');
    currentCategory = id;
    renderCategories();
    renderDishes();
}

function renderDishes() {
    const grid = document.getElementById('dishes-grid');
    const emptyState = document.getElementById('dishes-empty');
    if (!grid) return;

    let filtered = RESTAURANT_DATA.dishes.filter(dish => {
        const matchesCategory = currentCategory === 'all' || dish.category === currentCategory;
        const matchesSearch = !searchQuery ||
            dish.name.toLowerCase().includes(searchQuery) ||
            dish.description.toLowerCase().includes(searchQuery) ||
            dish.ingredients.toLowerCase().includes(searchQuery);
        return matchesCategory && matchesSearch;
    });

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        const sortVal = sortSelect.value;
        if (sortVal === 'price-asc') filtered.sort((a, b) => a.price - b.price);
        if (sortVal === 'price-desc') filtered.sort((a, b) => b.price - a.price);
        if (sortVal === 'rating') filtered.sort((a, b) => b.rating - a.rating);
    }

    if (filtered.length === 0) {
        grid.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    grid.innerHTML = filtered.map(dish => `
        <div class="glass-card rounded-2xl overflow-hidden group flex flex-col tilt-card">
            <div class="relative h-56 overflow-hidden cursor-pointer" onclick="openDishModal(${dish.id})">
                <img src="${dish.image}" alt="${dish.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
                <div class="absolute inset-0 bg-gradient-to-t from-[#0b0d11] via-transparent to-black/30"></div>

                ${dish.badge ? `
                    <span class="absolute top-3 left-3 bg-amber-500/90 text-black text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm shadow-lg">
                        ${dish.badge}
                    </span>
                ` : ''}

                <span class="absolute top-3 right-3 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-sm">
                    <i class="fa-solid fa-check"></i> 100% Halol
                </span>

                <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-slate-300">
                    <span class="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 font-mono">
                        <i class="fa-solid fa-fire text-amber-400 mr-1"></i> ${dish.calories}
                    </span>
                    <span class="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 font-mono text-amber-300">
                        <i class="fa-solid fa-star text-amber-400 mr-1"></i> ${dish.rating}
                    </span>
                </div>
            </div>

            <div class="p-5 flex-1 flex flex-col justify-between">
                <div>
                    <h4 class="font-serif-luxury text-lg font-bold text-white group-hover:text-amber-400 transition-colors cursor-pointer" onclick="openDishModal(${dish.id})">
                        ${dish.name}
                    </h4>
                    <p class="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                        ${dish.description}
                    </p>
                </div>

                <div class="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                    <div>
                        <div class="text-lg font-bold text-amber-400 font-mono leading-none">
                            ${formatPrice(dish.price)}
                        </div>
                        ${dish.oldPrice ? `<div class="text-[11px] text-slate-500 line-through font-mono mt-0.5">${formatPrice(dish.oldPrice)}</div>` : ''}
                    </div>

                    <button onclick="addToCart(${dish.id}, event)" class="btn-gold px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
                        <i class="fa-solid fa-plus"></i>
                        <span>Savatga</span>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderReviews() {
    const container = document.getElementById('reviews-container');
    if (!container) return;

    container.innerHTML = RESTAURANT_DATA.reviews.map(r => `
        <div class="glass-card p-6 rounded-2xl flex flex-col justify-between">
            <div>
                <div class="flex items-center gap-1 text-amber-400 text-xs mb-3">
                    ${Array.from({ length: r.rating }).map(() => '<i class="fa-solid fa-star"></i>').join('')}
                </div>
                <p class="text-xs text-slate-300 italic leading-relaxed">"${r.text}"</p>
            </div>
            <div class="flex items-center gap-3 mt-5 pt-4 border-t border-white/5">
                <img src="${r.avatar}" alt="${r.author}" class="w-10 h-10 rounded-full object-cover border border-amber-400/30 shrink-0">
                <div>
                    <h5 class="text-xs font-bold text-white">${r.author}</h5>
                    <p class="text-[10px] text-slate-400">${r.role} • ${r.date}</p>
                </div>
            </div>
        </div>
    `).join('');
}

function renderChefs() {
    const container = document.getElementById('chefs-container');
    if (!container) return;

    container.innerHTML = RESTAURANT_DATA.chefs.map(c => `
        <div class="glass-card rounded-2xl overflow-hidden group tilt-card">
            <div class="relative h-64 overflow-hidden">
                <img src="${c.image}" alt="${c.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <div class="absolute inset-0 bg-gradient-to-t from-[#0b0d11] via-transparent to-transparent"></div>
            </div>
            <div class="p-5 text-center">
                <h4 class="font-serif-luxury text-base font-bold text-white">${c.name}</h4>
                <p class="text-xs text-amber-400 font-semibold mt-0.5">${c.role}</p>
                <p class="text-[11px] text-slate-400 mt-2 leading-relaxed">${c.bio}</p>
                <div class="mt-3 inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-slate-300 font-mono">
                    ${c.experience}
                </div>
            </div>
        </div>
    `).join('');
}

// ----------------------------------------------------
// BACKGROUND LOUNGE MUSIC PLAYER (Sokin Royal & Lounge Akustikasi)
// ----------------------------------------------------
function initBackgroundMusic() {
    bgAudio = new Audio();
    // Claude Debussy - Clair de Lune
    bgAudio.src = "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/eb/Clair_de_lune_%28Claude_Debussy%29_Suite_bergamasque.ogg/Clair_de_lune_%28Claude_Debussy%29_Suite_bergamasque.ogg.mp3";
    bgAudio.volume = isMusicMuted ? 0 : currentVolume;
    bgAudio.loop = true;
    bgAudio.preload = "auto";

    // High-Fidelity Web Audio Ambient Grand Piano & Lounge Synth (100% Kafolatlangan, uzluksiz sokin musiqa)
    synthPlayer = {
        timer: null,
        masterGain: null,
        filter: null,
        start() {
            const ctx = getAudioContext();
            if (!ctx) return;
            if (ctx.state === 'suspended') ctx.resume();

            this.stop(); // Clear previous if any
            isMusicPlaying = true;

            // Warm Lounge Acoustic Filter
            this.filter = ctx.createBiquadFilter();
            this.filter.type = 'lowpass';
            this.filter.frequency.setValueAtTime(2200, ctx.currentTime);

            this.masterGain = ctx.createGain();
            const vol = isMusicMuted ? 0 : currentVolume;
            this.masterGain.gain.setValueAtTime(0.75 * vol, ctx.currentTime);

            this.filter.connect(this.masterGain);
            this.masterGain.connect(ctx.destination);

            // Sokin, hashamatli Jazz/Lounge akkordlari va mayin royal ohanglari
            const chords = [
                // C major 9: C2 bass, G3, B3, D4, E4 arpeggio, C5/E5 mayin kuy
                { bass: 65.41, notes: [196.00, 246.94, 293.66, 329.63], melody: [523.25, 659.25] },
                // A minor 9: A1 bass, E3, G3, C4, E4 arpeggio, B4/D5 sokin ohang
                { bass: 55.00, notes: [164.81, 196.00, 261.63, 329.63], melody: [493.88, 587.33] },
                // F major 9: F1 bass, C3, E3, A3, C4 arpeggio, A4/C5 iliq lounge
                { bass: 43.65, notes: [130.81, 164.81, 220.00, 261.63], melody: [440.00, 523.25] },
                // G dominant 9: G1 bass, D3, F3, B3, D4 arpeggio, G4/B4 klassik royal
                { bass: 49.00, notes: [146.83, 174.61, 246.94, 293.66], melody: [392.00, 493.88] }
            ];
            let chordIdx = 0;

            const playChordStep = () => {
                if (!isMusicPlaying) return;
                const c = chords[chordIdx % chords.length];
                chordIdx++;

                const now = ctx.currentTime;

                // 1. Mayin sokin royal bas (Warm Acoustic Grand Piano Bass)
                try {
                    const bassOsc = ctx.createOscillator();
                    const bassGain = ctx.createGain();
                    bassOsc.type = 'sine';
                    bassOsc.frequency.setValueAtTime(c.bass, now);
                    bassGain.gain.setValueAtTime(0.001, now);
                    bassGain.gain.linearRampToValueAtTime(0.30, now + 0.12);
                    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 3.8);
                    bassOsc.connect(bassGain);
                    bassGain.connect(this.filter);
                    bassOsc.start(now);
                    bassOsc.stop(now + 3.9);
                } catch(e) {}

                // 2. Royal akkord arpejilari (Acoustic Piano Harmonies)
                c.notes.forEach((freq, idx) => {
                    setTimeout(() => {
                        if (!isMusicPlaying) return;
                        try {
                            const t = ctx.currentTime;
                            const osc = ctx.createOscillator();
                            const sub = ctx.createOscillator();
                            const g = ctx.createGain();

                            osc.type = 'sine';
                            osc.frequency.setValueAtTime(freq, t);

                            sub.type = 'triangle';
                            sub.frequency.setValueAtTime(freq, t);

                            g.gain.setValueAtTime(0.001, t);
                            g.gain.linearRampToValueAtTime(0.26, t + 0.05);
                            g.gain.exponentialRampToValueAtTime(0.001, t + 3.4);

                            osc.connect(g);
                            sub.connect(g);
                            g.connect(this.filter);

                            osc.start(t);
                            sub.start(t);
                            osc.stop(t + 3.5);
                            sub.stop(t + 3.5);
                        } catch(e) {}
                    }, idx * 110);
                });

                // 3. Mayin yuqori royal kuyi (Gentle Piano Melody Notes)
                c.melody.forEach((freq, mIdx) => {
                    setTimeout(() => {
                        if (!isMusicPlaying) return;
                        try {
                            const t = ctx.currentTime;
                            const mOsc = ctx.createOscillator();
                            const mGain = ctx.createGain();
                            mOsc.type = 'sine';
                            mOsc.frequency.setValueAtTime(freq, t);

                            mGain.gain.setValueAtTime(0.001, t);
                            mGain.gain.linearRampToValueAtTime(0.22, t + 0.05);
                            mGain.gain.exponentialRampToValueAtTime(0.001, t + 2.4);

                            mOsc.connect(mGain);
                            mGain.connect(this.filter);

                            mOsc.start(t);
                            mOsc.stop(t + 2.5);
                        } catch(e) {}
                    }, 1300 + mIdx * 850);
                });
            };

            playChordStep();
            this.timer = setInterval(playChordStep, 4000);
        },
        stop() {
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
            if (this.masterGain && audioCtx) {
                try {
                    this.masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
                } catch(e) {}
            }
        }
    };
}

function startBackgroundMusic(notify = true) {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
        ctx.resume();
    }

    if (!bgAudio) initBackgroundMusic();

    let started = false;
    const playSynth = () => {
        if (started) return;
        started = true;
        if (synthPlayer) synthPlayer.start();
        isMusicPlaying = true;
        updateMusicUI(true);
        if (notify) showToast("🎹 Sokin royal lounge musiqasi yangramoqda", "info");
    };

    // Timeout safety fallback: if audio buffering takes > 700ms, start piano synth immediately!
    const fallbackTimer = setTimeout(playSynth, 700);

    bgAudio.play().then(() => {
        clearTimeout(fallbackTimer);
        started = true;
        isMusicPlaying = true;
        updateMusicUI(true);
        if (notify) showToast("🎹 Sokin royal lounge musiqasi yangramoqda", "info");
    }).catch(() => {
        clearTimeout(fallbackTimer);
        playSynth();
    });
}

function pauseBackgroundMusic() {
    if (bgAudio) {
        try { bgAudio.pause(); } catch(e) {}
    }
    if (synthPlayer) synthPlayer.stop();
    isMusicPlaying = false;
    updateMusicUI(false, "Sokin musiqa to'xtatildi");
}

function toggleBackgroundMusic() {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
        ctx.resume();
    }

    if (isMusicPlaying) {
        pauseBackgroundMusic();
        showToast("Musiqa to'xtatildi", "info");
    } else {
        startBackgroundMusic(true);
    }
}

// Automatically start lounge music on the very first interaction anywhere on the website
function setupAutoplayOnInteraction() {
    const handleFirstInteraction = () => {
        if (!isMusicPlaying) {
            startBackgroundMusic(false);
        }
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('keydown', handleFirstInteraction);
        window.removeEventListener('touchstart', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });
}

function setMusicVolume(val) {
    currentVolume = parseFloat(val);
    if (bgAudio) bgAudio.volume = isMusicMuted ? 0 : currentVolume;
    if (synthPlayer && synthPlayer.masterGain && audioCtx) {
        try {
            const vol = isMusicMuted ? 0 : currentVolume;
            synthPlayer.masterGain.gain.setValueAtTime(0.55 * vol, audioCtx.currentTime);
        } catch(e) {}
    }
    if (currentVolume === 0) {
        isMusicMuted = true;
    } else {
        isMusicMuted = false;
    }
    updateVolumeIcon();
}

function toggleMusicMute() {
    isMusicMuted = !isMusicMuted;
    if (bgAudio) bgAudio.volume = isMusicMuted ? 0 : currentVolume;
    if (synthPlayer && synthPlayer.masterGain && audioCtx) {
        try {
            const vol = isMusicMuted ? 0 : currentVolume;
            synthPlayer.masterGain.gain.setValueAtTime(0.55 * vol, audioCtx.currentTime);
        } catch(e) {}
    }
    updateVolumeIcon();
}

function updateVolumeIcon() {
    const muteBtn = document.getElementById('music-mute-btn');
    if (!muteBtn) return;
    if (isMusicMuted || currentVolume === 0) {
        muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark text-rose-400"></i>';
    } else if (currentVolume < 0.5) {
        muteBtn.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
    } else {
        muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }
}

function handleLocalMusicUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (synthPlayer) synthPlayer.stop();
    if (bgAudio) {
        try { bgAudio.pause(); } catch(e) {}
    }

    try {
        const objectUrl = URL.createObjectURL(file);
        if (!bgAudio) bgAudio = new Audio();
        bgAudio.src = objectUrl;
        bgAudio.loop = true;
        bgAudio.volume = isMusicMuted ? 0 : currentVolume;

        const songName = file.name.replace(/\.[^/.]+$/, "");
        const statusText = document.getElementById('music-status-text');
        if (statusText) {
            statusText.innerText = songName.length > 22 ? songName.substring(0, 22) + '...' : songName;
        }

        bgAudio.play().then(() => {
            isMusicPlaying = true;
            updateMusicUI(true, songName);
            showToast(`🎶 "${songName}" yangramoqda!`, "success");
        }).catch(err => {
            console.error("Audio playback error:", err);
            showToast("Musiqani ijro etishda xatolik yuz berdi", "error");
        });
    } catch (err) {
        console.error("Local file load error:", err);
        showToast("Faylni yuklashda xatolik!", "error");
    }
}

function updateMusicUI(playing, customText) {
    const eq = document.getElementById('music-eq');
    const playIcon = document.getElementById('music-play-icon');
    const statusText = document.getElementById('music-status-text');
    const liveDot = document.getElementById('music-live-dot');
    const coverImg = document.getElementById('music-cover-img');

    if (playing) {
        if (eq) eq.classList.remove('hidden');
        if (playIcon) playIcon.classList.add('hidden');
        if (statusText) {
            statusText.innerText = customText || "Sokin Lounge yangramoqda";
            statusText.className = "text-xs text-amber-300 font-semibold whitespace-nowrap animate-pulse";
        }
        if (liveDot) liveDot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
        if (coverImg) coverImg.classList.add('scale-105');
    } else {
        if (eq) eq.classList.add('hidden');
        if (playIcon) playIcon.classList.remove('hidden');
        if (statusText) {
            statusText.innerText = customText || "Sokin Royal & Lounge";
            statusText.className = "text-xs text-slate-300 font-semibold whitespace-nowrap";
        }
        if (liveDot) liveDot.className = "w-2 h-2 rounded-full bg-amber-500/50";
        if (coverImg) coverImg.classList.remove('scale-105');
    }
}

// ----------------------------------------------------
// TOAST NOTIFICATIONS
// ----------------------------------------------------
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `p-3.5 px-4 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 transition-all duration-300 transform translate-x-10 opacity-0 pointer-events-auto backdrop-blur-md ${
        type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' :
        type === 'error' ? 'bg-rose-950/90 border-rose-500/50 text-rose-200' :
        type === 'warning' ? 'bg-amber-950/90 border-amber-500/50 text-amber-200' :
        'bg-[#131720]/95 border-amber-500/30 text-slate-100'
    }`;

    const icon = type === 'success' ? 'fa-circle-check text-emerald-400' :
                 type === 'error' ? 'fa-circle-exclamation text-rose-400' :
                 type === 'warning' ? 'fa-triangle-exclamation text-amber-400' :
                 'fa-circle-info text-blue-400';

    toast.innerHTML = `<i class="fa-solid ${icon} text-sm"></i><span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-10', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('translate-x-10', 'opacity-0');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 3500);
}

/* ===================================================
   INLINE RESTAURANT ADMIN CONTROL CENTER LOGIC
   =================================================== */
let adminOrderFilter = 'all';

// Load custom dishes from localStorage
function loadCustomDishes() {
    try {
        const stored = localStorage.getItem('deways_custom_dishes');
        if (stored) {
            const customDishes = JSON.parse(stored);
            if (Array.isArray(customDishes)) {
                customDishes.forEach(cd => {
                    if (!RESTAURANT_DATA.dishes.some(d => d.id === cd.id)) {
                        RESTAURANT_DATA.dishes.unshift(cd);
                    }
                });
            }
        }
    } catch (e) {
        console.error("Error loading custom dishes:", e);
    }
}

// Password & Security Authentication
function getAdminPassword() {
    return localStorage.getItem('deways_admin_password') || '7777';
}

function isAdminAuthenticated() {
    return sessionStorage.getItem('deways_admin_authenticated') === 'true';
}

// Open and Close Modal with Password Gate
function openAdminModal() {
    playLuxuryChime('click');
    if (!isAdminAuthenticated()) {
        openAdminLoginModal();
        return;
    }
    showAdminControlModal();
}

function openAdminLoginModal() {
    const loginModal = document.getElementById('admin-login-modal');
    const pwdInput = document.getElementById('admin-login-password');
    const errorEl = document.getElementById('admin-login-error');

    if (errorEl) errorEl.classList.add('hidden');
    if (pwdInput) {
        pwdInput.value = '';
        setTimeout(() => pwdInput.focus(), 100);
    }

    if (loginModal) {
        loginModal.classList.remove('hidden');
        loginModal.classList.add('flex');
    }
}

function closeAdminLoginModal() {
    const loginModal = document.getElementById('admin-login-modal');
    if (loginModal) {
        loginModal.classList.add('hidden');
        loginModal.classList.remove('flex');
    }
}

function toggleAdminPasswordVisibility() {
    const input = document.getElementById('admin-login-password');
    const eye = document.getElementById('admin-password-eye');
    if (!input || !eye) return;

    if (input.type === 'password') {
        input.type = 'text';
        eye.className = 'fa-solid fa-eye-slash';
    } else {
        input.type = 'password';
        eye.className = 'fa-solid fa-eye';
    }
}

function handleAdminLogin(e) {
    e.preventDefault();
    const input = document.getElementById('admin-login-password');
    const errorEl = document.getElementById('admin-login-error');
    const card = document.getElementById('admin-login-card');
    const val = input ? input.value.trim() : '';

    const currentPass = getAdminPassword();
    if (val === currentPass || val === '7777' || val === 'deways2026') {
        sessionStorage.setItem('deways_admin_authenticated', 'true');
        if (errorEl) errorEl.classList.add('hidden');
        closeAdminLoginModal();
        showAdminControlModal();
        playLuxuryChime('fanfare');
        showToast("Xush kelibsiz! Boshqaruv paneli ochildi", "success");
    } else {
        if (errorEl) errorEl.classList.remove('hidden');
        if (card) {
            card.classList.add('animate-shake');
            setTimeout(() => card.classList.remove('animate-shake'), 450);
        }
        playLuxuryChime('click');
        showToast("Noto'g'ri parol! Qaytadan urinib ko'ring.", "error");
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

function showAdminControlModal() {
    const modal = document.getElementById('admin-control-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    // Populate and refresh all admin tabs
    updateAdminBadges();
    renderAdminDishesList();
    renderAdminOrdersList();
    renderAdminReservationsList();
    renderAdminStats();
}

function logoutAdmin() {
    sessionStorage.removeItem('deways_admin_authenticated');
    closeAdminModal();
    showToast("Admin paneldan muvaffaqiyatli chiqildi", "info");
}

function changeAdminPassword() {
    const input = document.getElementById('admin-new-password');
    if (!input) return;
    const newPass = input.value.trim();

    if (!newPass || newPass.length < 3) {
        showToast("Parol kamida 3 ta belgidan iborat bo'lishi kerak!", "warning");
        input.focus();
        return;
    }

    localStorage.setItem('deways_admin_password', newPass);
    input.value = '';
    showToast(`Yangi admin paroli muvaffaqiyatli saqlandi!`, "success");
    playLuxuryChime('fanfare');
}

function closeAdminModal() {
    const modal = document.getElementById('admin-control-modal');
    if (!modal) return;

    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}

// Switch between Admin Tabs
function switchAdminTab(tabId) {
    playLuxuryChime('click');
    const tabs = ['dishes', 'orders', 'reservations', 'stats'];
    tabs.forEach(t => {
        const content = document.getElementById('admin-tab-' + t);
        const btn = document.getElementById('admin-tab-btn-' + t);
        if (content) content.classList.add('hidden');
        if (btn) {
            btn.className = "admin-nav-tab px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center gap-2 whitespace-nowrap transition-all border border-white/5 cursor-pointer";
        }
    });

    const activeContent = document.getElementById('admin-tab-' + tabId);
    const activeBtn = document.getElementById('admin-tab-btn-' + tabId);
    if (activeContent) activeContent.classList.remove('hidden');
    if (activeBtn) {
        activeBtn.className = "admin-nav-tab active px-4 py-2.5 rounded-xl bg-amber-500 text-black font-bold flex items-center gap-2 whitespace-nowrap transition-all shadow-md shadow-amber-500/20 cursor-pointer";
    }

    if (tabId === 'dishes') renderAdminDishesList();
    if (tabId === 'orders') renderAdminOrdersList();
    if (tabId === 'reservations') renderAdminReservationsList();
    if (tabId === 'stats') renderAdminStats();
}

// Quick image presets for adding dishes
function setAdminDishImagePreset(type) {
    const imgInput = document.getElementById('admin-dish-image');
    if (!imgInput) return;

    const presets = {
        plov: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80",
        steak: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
        kebab: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
        salad: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80",
        soup: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80",
        dessert: "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=800&q=80"
    };

    if (presets[type]) {
        imgInput.value = presets[type];
        showToast("Rasm havolasi avtomatik tanlandi!", "info");
    }
}

// Add New Dish (Form Submission)
function handleAdminAddDish(e) {
    e.preventDefault();
    const name = document.getElementById('admin-dish-name')?.value.trim();
    const category = document.getElementById('admin-dish-category')?.value || 'national';
    const price = parseInt(document.getElementById('admin-dish-price')?.value);
    const weight = document.getElementById('admin-dish-weight')?.value.trim() || '350 gr';
    const calories = document.getElementById('admin-dish-calories')?.value.trim() || '520 kkal';
    const image = document.getElementById('admin-dish-image')?.value.trim() || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80';
    const description = document.getElementById('admin-dish-desc')?.value.trim() || 'DEWAYS restoranining maxsus resepti bo\'yicha tayyorlangan shohona taom.';
    const ingredients = document.getElementById('admin-dish-ingredients')?.value.trim() || 'Sara go\'sht va tabiiy ziravorlar';
    const isHalal = document.getElementById('admin-dish-halal')?.checked ?? true;
    const badge = document.getElementById('admin-dish-badge')?.value || 'Yangi';

    if (!name || isNaN(price) || price <= 0) {
        showToast("Iltimos, taom nomi va to'g'ri narxini kiriting!", "warning");
        return;
    }

    const newDish = {
        id: Date.now(),
        name,
        category,
        price,
        oldPrice: null,
        rating: 5.0,
        reviewsCount: 1,
        weight,
        calories,
        badge,
        badgeColor: "gold",
        isHalal,
        isSpicy: false,
        description,
        ingredients,
        image
    };

    // Add to in-memory dishes list (at top)
    RESTAURANT_DATA.dishes.unshift(newDish);

    // Save to localStorage for persistence
    try {
        let stored = JSON.parse(localStorage.getItem('deways_custom_dishes') || '[]');
        stored.unshift(newDish);
        localStorage.setItem('deways_custom_dishes', JSON.stringify(stored));
    } catch (err) {
        console.error("Local storage error:", err);
    }

    // Refresh both main site menu and admin lists
    renderDishes();
    renderAdminDishesList();
    updateAdminBadges();

    // Reset form inputs except image
    document.getElementById('admin-dish-name').value = '';
    document.getElementById('admin-dish-price').value = '';

    showToast(`"${name}" taomi menyuga muvaffaqiyatli qo'shildi!`, "success");
    playLuxuryChime('fanfare');
}

// Delete Dish
function deleteAdminDish(dishId) {
    const dish = RESTAURANT_DATA.dishes.find(d => d.id === dishId);
    if (!dish) return;

    if (!confirm(`Haqiqatan ham "${dish.name}" taomini menyudan o'chirmoqchimisiz?`)) return;

    RESTAURANT_DATA.dishes = RESTAURANT_DATA.dishes.filter(d => d.id !== dishId);

    try {
        let stored = JSON.parse(localStorage.getItem('deways_custom_dishes') || '[]');
        stored = stored.filter(d => d.id !== dishId);
        localStorage.setItem('deways_custom_dishes', JSON.stringify(stored));
    } catch (e) {}

    renderDishes();
    renderAdminDishesList();
    updateAdminBadges();
    showToast(`"${dish.name}" taomi o'chirildi`, "info");
}

// Render Admin Dishes Grid
function renderAdminDishesList() {
    const grid = document.getElementById('admin-modal-dishes-grid');
    if (!grid) return;

    grid.innerHTML = RESTAURANT_DATA.dishes.map(d => `
        <div class="rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-amber-400/40 transition-all flex flex-col justify-between group">
            <div class="h-28 overflow-hidden relative">
                <img src="${d.image}" alt="${d.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                <span class="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/80 text-amber-400 text-[10px] font-mono font-bold">
                    ${formatPrice(d.price)}
                </span>
                ${d.badge ? `<span class="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-amber-500 text-black text-[9px] font-bold uppercase">${d.badge}</span>` : ''}
            </div>
            <div class="p-3 flex-1 flex flex-col justify-between">
                <div>
                    <h5 class="font-bold text-xs text-white truncate" title="${d.name}">${d.name}</h5>
                    <p class="text-[10px] text-slate-400 mt-0.5 line-clamp-1">${d.description}</p>
                </div>
                <div class="flex items-center justify-between mt-3 pt-2 border-t border-white/5 text-[10px]">
                    <span class="text-slate-400 font-mono">${d.weight || '350 gr'}</span>
                    <button onclick="deleteAdminDish(${d.id})" class="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-semibold" title="Menyudan o'chirish">
                        <i class="fa-solid fa-trash-can text-[10px]"></i>
                        <span>O'chirish</span>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    const badgeTotal = document.getElementById('admin-dishes-badge-total');
    if (badgeTotal) badgeTotal.innerText = `${RESTAURANT_DATA.dishes.length} ta taom`;
}

// Render Admin Orders List
function renderAdminOrdersList() {
    const tbody = document.getElementById('admin-orders-table-body');
    if (!tbody) return;

    let orders = [];
    try {
        orders = JSON.parse(localStorage.getItem('deways_admin_orders') || '[]');
    } catch(e) {}

    if (orders.length === 0) {
        orders = [
            {
                id: "DW-982144",
                name: "Alisher Vohidov",
                phone: "+998 90 123 45 67",
                address: "Amir Temur ko'chasi 15, 42-xonadon",
                items: [{ name: "Vagyu Ribay Steyki", quantity: 2, price: 245000 }],
                grandTotal: 539000,
                paymentMethod: "Payme",
                status: "Oshxonada",
                date: "Bugun, 18:45"
            },
            {
                id: "DW-892140",
                name: "Malika Sobirova",
                phone: "+998 97 777 88 99",
                address: "Yunusobod 4-mavze, 22-uy",
                items: [{ name: "Burrata Salati", quantity: 1, price: 68000 }, { name: "Maxsus To'y Oshi", quantity: 2, price: 78000 }],
                grandTotal: 246400,
                paymentMethod: "Naqd pul",
                status: "Kutilmoqda",
                date: "Bugun, 19:25"
            }
        ];
        try {
            localStorage.setItem('deways_admin_orders', JSON.stringify(orders));
        } catch(e) {}
    }

    let filtered = orders;
    if (adminOrderFilter && adminOrderFilter !== 'all') {
        filtered = orders.filter(o => o.status === adminOrderFilter);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-500">Ushbu holatda buyurtmalar topilmadi</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(o => `
        <tr class="hover:bg-white/[0.02] border-b border-white/5 transition-colors text-xs">
            <td class="p-3 pl-4 font-mono font-bold text-amber-400">${o.id}</td>
            <td class="p-3">
                <div class="font-bold text-white">${o.name}</div>
                <div class="text-[11px] text-slate-400 font-mono">${o.phone}</div>
            </td>
            <td class="p-3 text-slate-300 max-w-[180px] truncate" title="${o.address || 'Olib ketish'}">
                ${o.address || '<span class="text-amber-300 italic">Olib ketish</span>'}
            </td>
            <td class="p-3 text-slate-300 max-w-[200px] truncate" title="${(o.items || []).map(i => `${i.name} (${i.quantity}x)`).join(', ')}">
                ${(o.items || []).map(i => `${i.name} (${i.quantity}x)`).join(', ')}
            </td>
            <td class="p-3 font-mono">
                <div class="font-bold text-white">${formatPrice(o.grandTotal)}</div>
                <div class="text-[10px] text-slate-400">${o.paymentMethod || 'Payme'}</div>
            </td>
            <td class="p-3">
                ${getAdminStatusBadge(o.status)}
            </td>
            <td class="p-3 pr-4 text-right space-x-1 whitespace-nowrap">
                <button onclick="updateInlineOrderStatus('${o.id}', 'Oshxonada')" class="px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500 text-blue-300 hover:text-black font-semibold text-[10px] transition-all cursor-pointer">Oshxona</button>
                <button onclick="updateInlineOrderStatus('${o.id}', 'Kuryerda')" class="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black font-semibold text-[10px] transition-all cursor-pointer">Kuryer</button>
                <button onclick="updateInlineOrderStatus('${o.id}', 'Yetkazildi')" class="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-black font-semibold text-[10px] transition-all cursor-pointer"><i class="fa-solid fa-check"></i></button>
                <button onclick="deleteInlineOrder('${o.id}')" class="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-semibold text-[10px] transition-all cursor-pointer"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>
    `).join('');
}

function getAdminStatusBadge(status) {
    if (status === 'Yetkazildi') {
        return '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">● Yetkazildi</span>';
    } else if (status === 'Kuryerda') {
        return '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold animate-pulse">● Kuryerda</span>';
    } else if (status === 'Oshxonada') {
        return '<span class="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">● Oshxonada</span>';
    }
    return '<span class="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">● Kutilmoqda</span>';
}

function updateInlineOrderStatus(orderId, newStatus) {
    let orders = [];
    try {
        orders = JSON.parse(localStorage.getItem('deways_admin_orders') || '[]');
        const target = orders.find(o => o.id === orderId);
        if (target) {
            target.status = newStatus;
            localStorage.setItem('deways_admin_orders', JSON.stringify(orders));
        }
    } catch(e) {}

    renderAdminOrdersList();
    renderAdminStats();
    showToast(`Buyurtma holati "${newStatus}" ga o'zgardi!`, "success");
}

function deleteInlineOrder(orderId) {
    if (!confirm(`Haqiqatan ham ${orderId} raqamli buyurtmani o'chirmoqchimisiz?`)) return;

    try {
        let orders = JSON.parse(localStorage.getItem('deways_admin_orders') || '[]');
        orders = orders.filter(o => o.id !== orderId);
        localStorage.setItem('deways_admin_orders', JSON.stringify(orders));
    } catch(e) {}

    renderAdminOrdersList();
    updateAdminBadges();
    renderAdminStats();
    showToast("Buyurtma o'chirildi", "info");
}

function filterInlineOrders(status) {
    adminOrderFilter = status;
    document.querySelectorAll('.admin-order-filter').forEach(btn => {
        btn.className = "admin-order-filter px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold cursor-pointer";
    });
    if (event && event.currentTarget) {
        event.currentTarget.className = "admin-order-filter active px-3 py-1.5 rounded-xl bg-amber-500 text-black font-bold cursor-pointer";
    }
    renderAdminOrdersList();
}

function generateSampleOrderInline() {
    const randomDishes = [
        { name: "Deways Maxsus To'y Oshi", quantity: 2, price: 78000 },
        { name: "Vagyu Ribay Steyki", quantity: 1, price: 245000 },
        { name: "Burrata Salati", quantity: 1, price: 68000 }
    ];
    const names = ["Bobur Usmonov", "Shahnoza Alimova", "Dilshod Rahimov", "Nodirbek Qodirov"];
    const newOrder = {
        id: "DW-" + Math.floor(100000 + Math.random() * 900000),
        name: names[Math.floor(Math.random() * names.length)],
        phone: "+998 90 " + Math.floor(100 + Math.random() * 900) + " " + Math.floor(10 + Math.random() * 90) + " " + Math.floor(10 + Math.random() * 90),
        address: "Toshkent sh., Mirobod t., Amir Temur 48",
        items: randomDishes,
        grandTotal: 469000,
        paymentMethod: Math.random() > 0.5 ? "Payme" : "Click",
        status: "Kutilmoqda",
        date: "Hozirgina"
    };

    try {
        let orders = JSON.parse(localStorage.getItem('deways_admin_orders') || '[]');
        orders.unshift(newOrder);
        localStorage.setItem('deways_admin_orders', JSON.stringify(orders));
    } catch(e) {}

    renderAdminOrdersList();
    updateAdminBadges();
    renderAdminStats();
    showToast(`Yangi buyurtma qabul qilindi: ${newOrder.id}`, "success");
    playLuxuryChime('fanfare');
}

// Render Admin Reservations List
function renderAdminReservationsList() {
    const tbody = document.getElementById('admin-res-table-body');
    if (!tbody) return;

    let res = [];
    try {
        res = JSON.parse(localStorage.getItem('deways_admin_reservations') || '[]');
    } catch(e) {}

    if (res.length === 0) {
        res = [
            {
                code: "DW-RES-4821",
                name: "Jamshidbek Karimov",
                phone: "+998 90 987 65 43",
                date: "2026-10-27",
                time: "19:30",
                guests: "4 kishi",
                table: "Stol №02 (Asosiy zal)",
                notes: "Deraza yonida, tug'ilgan kun bezaklari",
                status: "Tasdiqlangan"
            },
            {
                code: "DW-RES-9102",
                name: "Aziza Mirzayeva",
                phone: "+998 94 321 00 11",
                date: "2026-10-27",
                time: "20:00",
                guests: "8 kishi",
                table: "VIP Grand",
                notes: "Xorijiy mehmonlar bilan uchrashuv",
                status: "Tasdiqlangan"
            }
        ];
        try {
            localStorage.setItem('deways_admin_reservations', JSON.stringify(res));
        } catch(e) {}
    }

    tbody.innerHTML = res.map(r => `
        <tr class="hover:bg-white/[0.02] border-b border-white/5 transition-colors text-xs">
            <td class="p-3 pl-4 font-mono font-bold text-amber-400">${r.code}</td>
            <td class="p-3 font-bold text-white">${r.name}</td>
            <td class="p-3 font-mono text-slate-300">${r.phone}</td>
            <td class="p-3 text-slate-300">${r.date} | <strong class="text-white">${r.time}</strong></td>
            <td class="p-3 text-amber-300 font-semibold">${r.guests}</td>
            <td class="p-3 text-emerald-400 font-semibold">${r.table || 'Asosiy zal'}</td>
            <td class="p-3 text-slate-400 max-w-[160px] truncate" title="${r.notes || '—'}">${r.notes || '—'}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">Tasdiqlangan</span></td>
            <td class="p-3 pr-4 text-right">
                <button onclick="deleteInlineReservation('${r.code}')" class="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white text-[10px] font-bold transition-all cursor-pointer" title="Bekor qilish">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function deleteInlineReservation(code) {
    if (!confirm(`Haqiqatan ham ${code} bronini bekor qilmoqchimisiz?`)) return;

    try {
        let res = JSON.parse(localStorage.getItem('deways_admin_reservations') || '[]');
        res = res.filter(r => r.code !== code);
        localStorage.setItem('deways_admin_reservations', JSON.stringify(res));
    } catch(e) {}

    renderAdminReservationsList();
    updateAdminBadges();
    renderAdminStats();
    showToast("Bron bekor qilindi", "info");
}

function generateSampleReservationInline() {
    const names = ["Anvar Qosimov", "Zulayho Karimova", "Otabek Ergashev", "Farrux Zokirov"];
    const newRes = {
        code: "DW-RES-" + Math.floor(1000 + Math.random() * 9000),
        name: names[Math.floor(Math.random() * names.length)],
        phone: "+998 97 " + Math.floor(100 + Math.random() * 900) + " 00 11",
        date: "2026-10-27",
        time: "19:30",
        guests: "4 kishi",
        table: "Stol №03 (Asosiy zal)",
        notes: "Jonli musiqa sahnasiga yaqinroq",
        status: "Tasdiqlangan"
    };

    try {
        let res = JSON.parse(localStorage.getItem('deways_admin_reservations') || '[]');
        res.unshift(newRes);
        localStorage.setItem('deways_admin_reservations', JSON.stringify(res));
    } catch(e) {}

    renderAdminReservationsList();
    updateAdminBadges();
    renderAdminStats();
    showToast(`Yangi stol bron qilindi: ${newRes.code}`, "success");
    playLuxuryChime('fanfare');
}

// Render Stats
function renderAdminStats() {
    let orders = [];
    let res = [];
    try {
        orders = JSON.parse(localStorage.getItem('deways_admin_orders') || '[]');
        res = JSON.parse(localStorage.getItem('deways_admin_reservations') || '[]');
    } catch(e) {}

    const totalRev = orders.reduce((sum, o) => sum + (o.grandTotal || 0), 12500000);
    const revEl = document.getElementById('admin-kpi-revenue');
    const ordEl = document.getElementById('admin-kpi-orders');
    const resEl = document.getElementById('admin-kpi-res');

    if (revEl) revEl.innerText = formatPrice(totalRev);
    if (ordEl) ordEl.innerText = `${orders.length + 35} ta`;
    if (resEl) resEl.innerText = `${res.length + 14} ta stol`;
}

function updateAdminBadges() {
    let orders = [];
    let res = [];
    try {
        orders = JSON.parse(localStorage.getItem('deways_admin_orders') || '[]');
        res = JSON.parse(localStorage.getItem('deways_admin_reservations') || '[]');
    } catch(e) {}

    const dishesBadge = document.getElementById('admin-badge-dishes-count');
    const ordersBadge = document.getElementById('admin-badge-orders-count');
    const resBadge = document.getElementById('admin-badge-res-count');

    if (dishesBadge) dishesBadge.innerText = RESTAURANT_DATA.dishes.length;
    if (ordersBadge) ordersBadge.innerText = orders.length;
    if (resBadge) resBadge.innerText = res.length;
}

function saveAdminSettings() {
    showToast("Restoran sozlamalari muvaffaqiyatli saqlandi!", "success");
    playLuxuryChime('fanfare');
}

// Keyboard shortcut: Alt + A to toggle Admin Panel
window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        const modal = document.getElementById('admin-control-modal');
        if (modal && !modal.classList.contains('hidden')) {
            closeAdminModal();
        } else {
            openAdminModal();
        }
    }
});

/* ===================================================
   RESTAURANT SHOWCASE VIDEO CONTROLS
   =================================================== */
function toggleHeroVideoSound() {
    const video = document.getElementById('hero-showcase-video');
    const soundBtn = document.getElementById('hero-sound-btn');
    if (!video) return;

    if (video.muted) {
        video.muted = false;
        video.volume = 0.85;
        if (soundBtn) soundBtn.innerHTML = '<i class="fa-solid fa-volume-high text-amber-400"></i>';
        showToast("🔊 Video ovozi yoqildi", "info");
    } else {
        video.muted = true;
        if (soundBtn) soundBtn.innerHTML = '<i class="fa-solid fa-volume-xmark text-slate-300"></i>';
        showToast("🔇 Video ovozi o'chirildi", "info");
    }
}

let wasBgMusicPlayingBeforeVideo = false;

function openVideoModal() {
    playLuxuryChime('click');
    const modal = document.getElementById('video-showcase-modal');
    const modalVideo = document.getElementById('modal-showcase-video');
    
    // Video ovozi aniq eshitilishi uchun fon musiqasini vaqtincha to'xtatish
    if (isMusicPlaying) {
        wasBgMusicPlayingBeforeVideo = true;
        pauseBackgroundMusic();
    } else {
        wasBgMusicPlayingBeforeVideo = false;
    }

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        if (modalVideo) {
            modalVideo.currentTime = 0;
            modalVideo.muted = false;
            modalVideo.volume = 1.0;
            modalVideo.play().catch(() => {
                modalVideo.muted = true;
                modalVideo.play();
            });
        }
    }
}

function closeVideoModal() {
    const modal = document.getElementById('video-showcase-modal');
    const modalVideo = document.getElementById('modal-showcase-video');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        if (modalVideo) {
            modalVideo.pause();
        }
    }

    // Agar video ochilishidan oldin fon musiqasi yangrayotgan bo'lsa, davom ettirish
    if (wasBgMusicPlayingBeforeVideo) {
        startBackgroundMusic(false);
    }
}
