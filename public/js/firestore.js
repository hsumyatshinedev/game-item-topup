import { db } from './firebase.js';
import { 
  collection, onSnapshot, query, where, limit, orderBy, 
  doc, getDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, addDoc 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { $, getPriceString, observeElement, showToast, createPromoCard, showCommentModal } from './ui.js'; // ⚠️ showCommentModal ထပ်ထည့်

export let allProducts = [];
export let groupedProducts = {};
export let allPromotions = [];
export let allNotifications = [];
export let unreadNotificationCount = 0;
export let allBanners = [];

let promoListener = null;
let configListener = null;
let notificationListener = null;
let bannerListener = null;
let slideInterval = null;
let activeCommentListener = null; 

export function openComments(promoId, promoTitle, currentUser) {
  if (!currentUser) {
    return showToast("Please sign in to comment.", "error");
  }

  if (activeCommentListener) activeCommentListener();
  
  showCommentModal(true, promoTitle, [], null);
  
  const commentsRef = collection(db, "promotions", promoId, "comments");
  const q = query(commentsRef, orderBy("createdAt", "asc"));
  
  activeCommentListener = onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    showCommentModal(true, promoTitle, comments, async (text) => {
      try {
        await addDoc(commentsRef, {
          text: text,
          userId: currentUser.uid,
          userName: currentUser.displayName || currentUser.email,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Error posting comment:", err);
        showToast("Failed to post comment.", "error");
      }
    });
  });
}

export function listenForProducts(currentCurrency) {
  const prodCollection = collection(db, "products");
  
  onSnapshot(prodCollection, (snapshot) => {
    allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    groupedProducts = allProducts.reduce((acc, product) => {
      const groupID = product.group; 
      if (!groupID) return acc;
      
      if (!acc[groupID]) {
        acc[groupID] = {
          groupDisplayName: product.groupDisplayName || groupID,
          groupBanner: product.groupBanner,
          image: product.image,
          minPrice: { usd: Infinity, mmk: Infinity, thb: Infinity, myr: Infinity },
          products: [] 
        };
      }
      acc[groupID].products.push(product);

      if (product.options && product.options.length > 0) {
        product.options.forEach(opt => {
          const priceObj = opt.price; 
          if (priceObj) {
            acc[groupID].minPrice.usd = Math.min(acc[groupID].minPrice.usd, priceObj.usd || Infinity);
            acc[groupID].minPrice.mmk = Math.min(acc[groupID].minPrice.mmk, priceObj.mmk || Infinity);
            acc[groupID].minPrice.thb = Math.min(acc[groupID].minPrice.thb, priceObj.thb || Infinity);
            acc[groupID].minPrice.myr = Math.min(acc[groupID].minPrice.myr, priceObj.myr || Infinity);
          }
        });
      }
      
      return acc;
    }, {});
    
    renderGameGroups(groupedProducts, currentCurrency); 
    renderHomeFeaturedGames(groupedProducts, currentCurrency);
    
  }, (error) => {
    console.error("Error listening for products: ", error);
    $('groupGrid').innerHTML = '<div class="muted" style="text-align: center; grid-column: 1 / -1; color: var(--error);">Error loading games.</div>';
  });
}

export function listenForPromotions(currentUser, currentCurrency) {
  if (promoListener) {
    promoListener();
  }
  
  const promoQuery = query(
    collection(db, "promotions"),
    orderBy("createdAt", "desc")
  );
  
  promoListener = onSnapshot(promoQuery, (snapshot) => {
    allPromotions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    renderFirebasePromotions(allPromotions, currentUser, currentCurrency); 
    renderHomeLatestPromotions(allPromotions, currentUser, currentCurrency);
    
  }, (error) => {
    console.error("Error listening for promotions: ", error);
    $('social-list-container').innerHTML = '<div class="muted" style="text-align: center; color: var(--error);">Error loading promotions.</div>';
  });
}

export function listenForUserNotifications(uid, renderNotificationBadge) {
  if (notificationListener) notificationListener(); 

  const notiQuery = query(
    collection(db, "notifications"),
    where("userId", "==", uid),
    orderBy("createdAt", "desc"),
    limit(20) 
  );
  
  notificationListener = onSnapshot(notiQuery, (snapshot) => {
    allNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    unreadNotificationCount = allNotifications.filter(n => n.read === false).length;

    renderNotificationBadge(unreadNotificationCount); 
    
    if ($('notificationModalWrap').style.visibility === 'visible') {
      renderNotificationList(allNotifications);
    }
    
  }, (err) => {
    console.error("Error listening for notifications:", err);
  });
}

export function stopNotificationListener() {
  if (notificationListener) {
    notificationListener();
    notificationListener = null;
  }
  allNotifications = [];
  unreadNotificationCount = 0;
}

export function listenForBanners() {
  if (bannerListener) bannerListener(); 
  const bannerQuery = query(
    collection(db, "heroBanners"),
    orderBy("createdAt", "desc")
  );
  
  bannerListener = onSnapshot(bannerQuery, (snapshot) => {
    allBanners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderBanners(allBanners); 
  }, (err) => {
    console.error("Error listening for banners:", err);
    $('heroCarousel').style.display = 'none'; 
  });
}

export function listenForConfig(onConfigUpdate) {
  if (configListener) configListener(); 
  
  const configRef = doc(db, "config", "main");
  configListener = onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists()) {
      const config = docSnap.data();
      onConfigUpdate(config); 
    } else {
      console.warn("Admin config not set. Using default rates and numbers.");
      onConfigUpdate(null);
    }
  });
}

export async function handleLikeClick(e, currentUser) {
  const likeBtn = e.target.closest('.like-btn');
  if (!likeBtn) return; 
  
  if (likeBtn.classList.contains('comment-btn')) return;

  if (!currentUser) {
    return showToast("Please sign in to like posts", "error");
  }
  
  const promoId = likeBtn.dataset.promoId;
  if (!promoId) return;
  
  likeBtn.disabled = true;
  
  const promoRef = doc(db, "promotions", promoId);
  const isLiked = likeBtn.classList.contains('active');
  
  try {
    if (isLiked) {
      await updateDoc(promoRef, {
        likes: arrayRemove(currentUser.uid)
      });
    } else {
      await updateDoc(promoRef, {
        likes: arrayUnion(currentUser.uid)
      });
    }
  } catch (err) {
    console.error("Error liking post:", err);
    showToast("Error: Could not update like.", "error");
  } finally {
    likeBtn.disabled = false;
  }
}

export async function markAllNotificationsAsRead(renderNotificationBadge) {
  const unreadNotifs = allNotifications.filter(n => n.read === false);
  
  if (unreadNotifs.length === 0) return; 
  
  console.log(`Marking ${unreadNotifs.length} notifications as read...`);
  unreadNotificationCount = 0;
  renderNotificationBadge(unreadNotificationCount); 
  
  allNotifications.forEach(n => {
    if (n.read === false) {
      n.read = true;
    }
  });

  const updatePromises = [];
  for (const noti of unreadNotifs) {
    const notiRef = doc(db, "notifications", noti.id);
    updatePromises.push(updateDoc(notiRef, { read: true }));
  }
  
  try {
    await Promise.all(updatePromises);
    console.log("Firebase notifications successfully marked as read.");
  } catch (err) {
    console.error("Error updating notifications in Firebase:", err);
  }
}

function renderGameGroups(groups, currentCurrency) {
  const grid = $('groupGrid');
  grid.innerHTML = '';
  
  if (Object.keys(groups).length === 0) {
    grid.innerHTML = '<div class="muted" style="text-align: center; grid-column: 1 / -1;">No games available right now.</div>';
    return;
  }

  Object.keys(groups).forEach((groupID, index) => {
    const groupData = groups[groupID];
    
    const card = document.createElement('div'); 
    card.className = 'game-card';
    card.dataset.groupId = groupID; 
    
    let minPriceText = getPriceString(groupData.minPrice, currentCurrency);
    if (minPriceText === "N/A") {
      minPriceText = "No packages";
    } else {
      minPriceText = `From ${minPriceText}`;
    }
    
    card.innerHTML = `
      <div class="game-card-img" style="background-image:url('${groupData.image || 'https://placehold.co/100x100/071433/7cf1ff?text=No+Img'}')"></div>
      <div class="game-card-info">
        <div class="game-card-title">${groupData.groupDisplayName}</div>
        <div class="game-card-meta">${minPriceText} • ${groupData.products.length} regions</div>
      </div>
    `;

    card.classList.add('scroll-animate');
    
    grid.appendChild(card);
    observeElement(card); 
  });
}
function renderFirebasePromotions(promotions, currentUser, currentCurrency) {
  const container = $('social-list-container');
  container.innerHTML = ''; 
  
  if (promotions.length === 0) {
    container.innerHTML = '<div class="muted" style="text-align: center;">No promotions available right now.</div>';
    return;
  }
  
  promotions.forEach((promo) => {
    const promoId = promo.id;
    const card = createPromoCard(promo, promoId, currentUser, (id, title) => {
        openComments(id, title, currentUser);
    }); 
    container.appendChild(card);
    observeElement(card);
  });
}

function renderHomeLatestPromotions(promotions, currentUser, currentCurrency) {
  const promoContainer = $('home-promo-list');
  promoContainer.innerHTML = '';
  const latestPromos = promotions.slice(0, 2);
  
  if (latestPromos.length === 0) {
    promoContainer.innerHTML = '<div class="muted">No promotions right now.</div>';
  } else {
    latestPromos.forEach(promo => {
      const promoId = promo.id;
      const card = createPromoCard(promo, promoId, currentUser, (id, title) => {
          openComments(id, title, currentUser);
      });
      promoContainer.appendChild(card);
      observeElement(card); 
    });
  }
}

export function renderHomePage(user, currency) {
  renderHomeWelcome(user);
  renderHomeFeaturedGames(groupedProducts, currency);
  renderHomeLatestPromotions(allPromotions, user, currency);
}

export function renderHomeWelcome(user) {
  const welcomeEl = $('homeWelcome');
  if (user) {
    welcomeEl.innerHTML = `Welcome back, <span>${user.displayName || user.name || user.email}</span>`;
  } else {
    welcomeEl.innerHTML = "Welcome to Faygo Store!";
  }
}

function renderHomeFeaturedGames(groups, currentCurrency) {
  const gamesContainer = $('homeFeaturedGames');
  gamesContainer.innerHTML = '';
  
  const gameGroups = Object.keys(groups);
  
  if (gameGroups.length === 0) {
    gamesContainer.innerHTML = '<div class="muted">Loading games...</div>';
    return; 
  }
  
  gameGroups.slice(0, 4).forEach(groupID => {
    const groupData = groups[groupID];
    const card = document.createElement('div');
    card.className = 'feat-game-card';
    card.classList.add('scroll-animate'); 
    card.dataset.groupId = groupID;
    card.innerHTML = `
      <div class="feat-game-card-img" style="background-image:url('${groupData.image || 'https://placehold.co/100x100/071433/7cf1ff?text=No+Img'}')"></div>
      <div class="feat-game-card-title">${groupData.groupDisplayName}</div>
    `;
    gamesContainer.appendChild(card);
    observeElement(card); 
  });
}

  function renderBanners(banners) {
  const container = document.getElementById('heroSliderContainer');
  const track = document.getElementById('heroSliderTrack');
  const dotsContainer = document.getElementById('heroSliderDots');
  
  if (!container || !track) return;

  const imageBanners = banners.filter(b => b.imageUrl);

  if (imageBanners.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  track.innerHTML = '';
  dotsContainer.innerHTML = '';
  
  imageBanners.forEach((banner, index) => {
    const slide = document.createElement('div');
    slide.className = 'slider-item';
    slide.innerHTML = `<img src="${banner.imageUrl}" alt="${banner.title || 'Banner'}" loading="lazy">`;
    track.appendChild(slide);
    
    const dot = document.createElement('div');
    dot.className = `dot ${index === 0 ? 'active' : ''}`;
    dotsContainer.appendChild(dot);
  });

  let currentIndex = 0;
  const totalSlides = imageBanners.length;
  
  if (totalSlides > 1) {
    if (slideInterval) clearInterval(slideInterval);
    
    slideInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % totalSlides;
      updateSliderPosition();
    }, 3000);
  }

  function updateSliderPosition() {
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    Array.from(dotsContainer.children).forEach((dot, idx) => {
      dot.classList.toggle('active', idx === currentIndex);
    });
  }
}