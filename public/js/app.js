import { auth, db, functions, storage } from './firebase.js'; 
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-functions.js";

import { 
  doc, getDoc, updateDoc, collection, getDocs, 
  query, orderBy, limit, startAfter, where 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

import { 
  initAuthListener, 
  attachAuthEvents, 
  logout, 
  saveProfile, 
  savePassword, 
  submitTopupRequest, 
  claimDailyBonus,
  renderDailyBonusButton,
  currentUser as authCurrentUser
} from './auth.js';

import { 
  listenForProducts, listenForPromotions, listenForUserNotifications, 
  stopNotificationListener, listenForBanners, listenForConfig, 
  handleLikeClick, markAllNotificationsAsRead, 
  allProducts, groupedProducts, allNotifications, 
  unreadNotificationCount, renderHomeWelcome
} from './firestore.js';

import { 
  $, initScrollObserver, hideLoader, showNotificationModal, 
  renderNotificationList, renderNotificationBadge, getPriceString, 
  formatCurrency, attachTabs, goToTab, showAuth, 
  renderUser, showBuyModal, showTopupModal, navigateTopupStep, 
  renderPaymentDetails, showProfileModal, showPasswordModal, showAboutModal, 
  setBuyMsg, setTopupMsg, showPurchaseSuccessModal, hidePurchaseSuccessModal, 
  openTopupModal, showToast, observeElement, 
  renderTransactions, updateBalanceAmount,
  showCommentModal, renderHeaderUser,
  playSound 
} from './ui.js';

let currentUser = null; 
let currentTabIndex = 0;
const CURRENCY_STORAGE_KEY = 'faygo_currency';
let currentCurrency = 'USD';
let EXCHANGE_RATES = { USD: 1, MMK: 3000, THB: 35, MYR: 4.8 };
let PAYMENT_INFO = { KBZPay: "Not Set", Wave: "Not Set" };
let currentGame = null;
let selectedPackage = null;
let currentGroupProducts = [];
let selectedTopupAmount = null; 
let customTopupAmount = null;  
let selectedTopupMethod = null;
let lastVisibleTransaction = null; 
let isTransactionsLoading = false; 
let currentTxFilter = 'all'; 

export function onUserLogin(userFromAuth) {
  currentUser = userFromAuth; 
  
  renderHomeWelcome(currentUser); 
  renderDailyBonusButton(); 
  listenForUserNotifications(currentUser.uid, renderNotificationBadge);
  listenForPromotions(currentUser, currentCurrency);  
  showAuth(false); 

  if (!currentUser.transactionPin) {
      setTimeout(() => {
          setupTransactionPIN(true); 
      }, 800);
  }
}

export function onUserLogout() {
  currentUser = null;
  
  renderHomeWelcome(null);   
  renderDailyBonusButton();
  stopNotificationListener();
  renderNotificationBadge(0); 
  listenForPromotions(null, currentCurrency);
  showAuth(true, false); 
}

function handleConfigUpdate(config) {
  const screen = document.getElementById('maintenance-screen');
  if (config && config.maintenanceMode === true) {
    screen.style.display = 'flex'; 
  } else {
    screen.style.display = 'none'; 
  }

  if (config) {
    EXCHANGE_RATES.MMK = config.rateMMK || 3000;
    EXCHANGE_RATES.THB = config.rateTHB || 35;
    EXCHANGE_RATES.MYR = config.rateMYR || 4.8;
    PAYMENT_INFO.KBZPay = config.kpayNumber || "Not Configured";
    PAYMENT_INFO.Wave = config.waveNumber || "Not Configured";
  }
  
  updateBalanceAmount(currentUser, currentCurrency, EXCHANGE_RATES, formatCurrency);
  
  if ($('topupModalWrap').style.visibility === 'visible') {
    renderPaymentDetails(
      selectedTopupAmount, 
      selectedTopupMethod, 
      PAYMENT_INFO, 
      formatCurrency, 
      currentCurrency, 
      EXCHANGE_RATES
    );
  }
}

function handleTabClick(newIndex) {
  if (newIndex === currentTabIndex) return currentTabIndex; 
  
  const oldTabIndex = currentTabIndex;
  currentTabIndex = newIndex;

  if (window.location.hash === '#detail') {
    history.replaceState({ page: 'main' }, '', window.location.pathname);
  }

  const panes = [$('home'), $('shop'), $('wallet'), $('social'), $('settings')];
  const oldPane = panes[oldTabIndex]; 
  const newPane = panes[newIndex];     
  
  panes.forEach(p => {
    if (p) { 
      p.classList.remove('show', 'slide-from-left');
      p.style.animation = 'none';
    }
  });

  if (newIndex > oldTabIndex) {
    if (oldPane) oldPane.style.transform = 'translateX(-20px)';
    if (newPane) newPane.classList.add('slide-from-left');
  } else {
    if (oldPane) oldPane.style.transform = 'translateX(20px)';
    if (newPane) newPane.classList.remove('slide-from-left');
  }
  
  if (oldPane) {
    oldPane.style.opacity = 0;
    oldPane.style.pointerEvents = 'none';
  }
  if (newPane) {
    newPane.classList.add('show');
    newPane.style.opacity = 1;
    newPane.style.pointerEvents = 'auto';
    newPane.style.transform = 'translateX(0)';

    if (newIndex === 2) { 
      updateBalanceAmount(currentUser, currentCurrency, EXCHANGE_RATES, formatCurrency);
      renderHeaderUser(currentUser); 
      
      currentTxFilter = 'all';
      const filterGroup = $("txFilterGroup");
      if (filterGroup) {
        filterGroup.querySelectorAll('.btn-filter').forEach(btn => {
          btn.classList.remove('active');
          if (btn.dataset.filter === 'all') {
            btn.classList.add('active');
          }
        });
      }
      
      lastVisibleTransaction = null; 
      loadTransactions(false);
    }
  }
  
  return oldTabIndex; 
}

function handleSearch() {
  const searchTerm = $('searchBar').value.toLowerCase();
  const gameCards = document.querySelectorAll('#groupGrid .game-card');
  gameCards.forEach(card => {
    const title = card.querySelector('.game-card-title').textContent.toLowerCase();
    if (title.includes(searchTerm)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

function handleGameCardClick(event) {
  const card = event.target.closest('.game-card, .feat-game-card');
  if (card && card.dataset.groupId) {
    openDetailPage(card.dataset.groupId);
  }
}

function openDetailPage(groupID) {
  const groupData = groupedProducts[groupID];
  if (!groupData) return;
  currentGroupProducts = groupData.products.sort((a, b) => a.name.localeCompare(b.name));
  const detailPane = $('detailPane');
  const title = $('detailTitle');
  const tabBar = $('detailTabBar');
  const pkgContainer = $('detailPackageContainer');
  const banner = $('detailBanner');
  title.textContent = groupData.groupDisplayName;
  banner.style.backgroundImage = groupData.groupBanner ? `url('${groupData.groupBanner}')` : 'none';
  banner.style.display = groupData.groupBanner ? 'block' : 'none';
  tabBar.innerHTML = '';
  pkgContainer.innerHTML = '';
  currentGroupProducts.forEach((product, index) => {
    const tab = document.createElement('button');
    tab.className = 'detail-tab-item';
    tab.textContent = product.name;
    tab.dataset.productId = product.id;
    if (index === 0) tab.classList.add('active'); 
    tab.addEventListener('click', () => switchDetailTab(product.id));
    tabBar.appendChild(tab);
    const list = document.createElement('div');
    list.className = 'detail-package-list';
    list.id = `packages-for-${product.id}`;
    if (index === 0) list.classList.add('show'); 
    if (product.options && product.options.length > 0) {
      product.options.forEach(pkgOption => {
        const el = document.createElement('div');
        el.className = 'pkg-item';
        el.innerHTML = `<div class="name">${pkgOption.name}</div><div class="price">${getPriceString(pkgOption.price, currentCurrency)}</div>`;
        el.addEventListener('click', () => openBuyModal(product.id, pkgOption));
        list.appendChild(el);
      });
    } else {
      list.innerHTML = '<div class="muted" style="text-align: center;">No packages here.</div>';
    }
    pkgContainer.appendChild(list);
  });
  detailPane.classList.add('show');
  document.querySelector('.tabs').style.display = 'none';
  history.pushState({ page: 'detail', group: groupID }, `Details: ${groupData.groupDisplayName}`, '#detail');
}

function switchDetailTab(productId) {
  document.querySelectorAll('.detail-package-list').forEach(l => l.classList.remove('show'));
  $(`packages-for-${productId}`).classList.add('show');
  document.querySelectorAll('.detail-tab-item').forEach(t => t.classList.remove('active'));
  document.querySelector(`.detail-tab-item[data-product-id="${productId}"]`).classList.add('active');
}

function openBuyModal(gameId, pkgOption) {
  setBuyMsg('');
  currentGame = allProducts.find(p => p.id === gameId);
  if (!currentGame) {
    showToast("Error: Could not find game data.", "error");
    return;
  }
  selectedPackage = pkgOption;
  const priceString = getPriceString(selectedPackage.price, currentCurrency);
  $('buyModalTitle').textContent = `Buy ${currentGame.name}`;
  $('buyModalSubtitle').textContent = `Selected: ${selectedPackage.name} - ${priceString}`;
  $('buyUserId').value = '';
  $('buyServerId').value = '';
  $('buyServerIdWrap').style.display = currentGame.requiresServerId ? 'block' : 'none';
  $('buyPackageField').style.display = 'none';
  showBuyModal(true);
}

async function confirmPurchase() {
  const userId = $('buyUserId').value.trim();
  const serverId = $('buyServerId').value.trim();
  const { value: inputPin } = await Swal.fire({
      title: 'Confirm Purchase',
      text: 'အတည်ပြုရန် PIN ရိုက်ထည့်ပါ',
      input: 'password',
      inputAttributes: { maxlength: 6, inputmode: 'numeric' },
      confirmButtonText: 'Verify & Buy',
      showCancelButton: true,
      background: '#071433', color: '#fff'
  });

  if (!inputPin) return; 

  setBuyMsg('');
  const btn = $('buyConfirmBtn');
  btn.disabled = true;
  btn.textContent = "Processing...";
  
  try {
    const purchaseItemFunction = httpsCallable(functions, 'processPurchase');
    const result = await purchaseItemFunction({
      productId: currentGame.id,       
      productSku: selectedPackage.sku,          
      gameUserId: userId,            
      gameServerId: serverId,
      pin: inputPin  
    });
  
  if (!userId) { return setBuyMsg('Please enter your Game User ID.'); }
  if (currentGame.requiresServerId && !serverId) { 
    return setBuyMsg('Please enter your Server ID (Zone ID).'); 
  }
  if (!selectedPackage) { return setBuyMsg('Please select a package to buy.'); }
  const productSku = selectedPackage.sku;
  if (!productSku) {
    console.error("Critical Error: Product SKU is missing:", selectedPackage);
    return setBuyMsg('This item is not available (SKU Missing).');
  }

  const isPinValid = await verifyTransactionPIN();
  if (!isPinValid) {
    return; 
  }
  setBuyMsg('');
  const btn = $('buyConfirmBtn');
  btn.disabled = true;
  btn.textContent = "Processing...";
  
  try {
    const purchaseItemFunction = httpsCallable(functions, 'processPurchase');
    const result = await purchaseItemFunction({
      productId: currentGame.id,       
      productSku: productSku,          
      gameUserId: userId,            
      gameServerId: serverId           
    });
    const resultData = result.data;
    
    if (resultData.success) {
      showBuyModal(false);
      playSound('success');
      
      const purchasePriceUSD = selectedPackage.price.usd || 0;
      const userRef = doc(db, "users", currentUser.uid);

      await updateDoc(userRef, {
          totalSpentUSD: (currentUser.totalSpentUSD || 0) + purchasePriceUSD
      });
      prepareInvoice({
          itemName: selectedPackage.name, 
          price: getPriceString(selectedPackage.price, currentCurrency), 
          userId: userId,
          serverId: serverId
      }); 
      showPurchaseSuccessModal(); 
    } else {
      setBuyMsg(resultData.error || "An unknown error occurred.");
    }
  } catch (err) {
    console.error("Cloud Function call failed:", err);
    setBuyMsg("Function Error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm Purchase";
  }
}

function handleNotificationClick() {
  showNotificationModal(
    true, 
    unreadNotificationCount, 
    allNotifications, 
    () => markAllNotificationsAsRead(renderNotificationBadge) 
  );
}

function loadCurrencySetting() {
  const savedCurrency = localStorage.getItem(CURRENCY_STORAGE_KEY);
  if (savedCurrency) {
    currentCurrency = savedCurrency;
  }
  $('currencySelect').value = currentCurrency;
}

function saveCurrencySetting() {
  currentCurrency = $('currencySelect').value;
  localStorage.setItem(CURRENCY_STORAGE_KEY, currentCurrency);
  showToast(`Currency set to ${currentCurrency}`, 'success');
  listenForProducts(currentCurrency); 
  listenForPromotions(currentUser, currentCurrency);
  updateBalanceAmount(currentUser, currentCurrency, EXCHANGE_RATES, formatCurrency);
  if ($('detailPane').classList.contains('show')) {
    $('detailPane').classList.remove('show');
    goToTab('shop');
  }
}

function handleTopupNext1() {
  const amountInput = $('topupAmountInput');
  const amount = parseFloat(amountInput.value);
  if (!amount || amount <= 0) {
    return setTopupMsg("Please enter a valid amount.", 1);
  }
  const currency = currentCurrency.toUpperCase();
  const rate = EXCHANGE_RATES[currency] || 1;
  let usdAmount = (currency === 'USD') ? amount : (amount / rate);
  if (usdAmount < 0.50) {
    return setTopupMsg(`Amount is too low. Minimum is ${formatCurrency(0.50, currency, EXCHANGE_RATES)}.`, 1);
  }
  customTopupAmount = amount; 
  selectedTopupAmount = usdAmount; 
  setTopupMsg('', 1); 
  navigateTopupStep(2); 
}

function handleTopupMethodSelect(event) {
  const item = event.target.closest('.pkg-item[data-provider]');
  if (!item) return;
  $('topup-method-grid').querySelectorAll('.pkg-item').forEach(i => i.classList.remove('selected'));
  item.classList.add('selected');
  selectedTopupMethod = item.dataset.provider;
  setTopupMsg('', 2); 
  renderPaymentDetails(
    selectedTopupAmount, 
    selectedTopupMethod, 
    PAYMENT_INFO, 
    formatCurrency, 
    currentCurrency, 
    EXCHANGE_RATES
  ); 
  navigateTopupStep(3); 
}

function handleTxFilterChange(newFilter) {
  if (newFilter === currentTxFilter) return;

  currentTxFilter = newFilter;

  const filterGroup = $("txFilterGroup");
  if (filterGroup) {
    filterGroup.querySelectorAll('.btn-filter').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.filter === newFilter) {
        btn.classList.add('active');
      }
    });
  }

  lastVisibleTransaction = null;
  loadTransactions(false);
}

async function loadTransactions(loadMore = false) {
  if (isTransactionsLoading || !currentUser) return; 
  
  isTransactionsLoading = true;
  const loadMoreBtn = $("loadMoreTxBtn");
  const loadingMsg = $("tx-loading-msg");
  const loadMoreContainer = $("load-more-container");
  
  if (loadMore) {
    if(loadMoreBtn) loadMoreBtn.disabled = true;
    if(loadingMsg) loadingMsg.style.display = 'block';
  } else {
    if(loadMoreContainer) loadMoreContainer.style.display = 'none';
    $('transList').innerHTML = '<p class_id="tx-loading-msg" class="muted" style="text-align: center; margin-top: 10px;">Loading transactions...</p>';
  }

  try {
    const txRef = collection(db, "users", currentUser.uid, "transactions");
    
    let queryConstraints = [orderBy("date", "desc")];
    
    if (currentTxFilter === 'purchase') {
      queryConstraints.push(where("type", "==", "purchase"));
    } else if (currentTxFilter === 'topup') {
      queryConstraints.push(where("type", "==", "topup"));
    }
    
    if (loadMore && lastVisibleTransaction) {
      queryConstraints.push(startAfter(lastVisibleTransaction));
    }
    
    queryConstraints.push(limit(20));
    
    const q = query(txRef, ...queryConstraints);

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.docs.length > 0) {
      lastVisibleTransaction = querySnapshot.docs[querySnapshot.docs.length - 1];
    }

    const transactions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    renderTransactions(transactions, loadMore, currentCurrency, EXCHANGE_RATES, formatCurrency, currentTxFilter);
    
    if (querySnapshot.docs.length < 20) {
      if(loadMoreContainer) loadMoreContainer.style.display = 'none';
    } else {
      if(loadMoreContainer) loadMoreContainer.style.display = 'block';
      if(loadMoreBtn) loadMoreBtn.disabled = false;
    }
    
  } catch (err) {
    console.error("Error loading transactions:", err);
    $('transList').innerHTML = `<p class="text-danger" style="text-align: center;">Error loading transactions: ${err.message}</p>`;
  } finally {
    isTransactionsLoading = false;
    if(loadingMsg) loadingMsg.style.display = 'none';
  }
}

function handlePopState() {
  if (window.location.hash !== '#detail') {
    $('detailPane').classList.remove('show');
    document.querySelector('.tabs').style.display = 'flex';
  }
}


function attachAllEventListeners() {
  
  document.body.addEventListener('click', (e) => {
    const target = e.target.closest('button, a, .btn, .btn-secondary, .btn-filter, .tab, .detail-tab-item, .game-card, .feat-game-card, .pkg-item, .like-btn, .slip-upload-label');
    
    if (target) {
      if (target.classList.contains('tab') || target.classList.contains('detail-tab-item')) {
        playSound('tab');
      } else {
        playSound('click');
      }
    }
  });

  attachTabs(handleTabClick); 
  attachAuthEvents();
  $('logoutBtn').addEventListener('click', logout);
  $('notificationBtn').addEventListener('click', handleNotificationClick);
  $('homeViewAllGames').addEventListener('click', (e) => { e.preventDefault(); goToTab('shop'); });
  $('homeViewAllSocial').addEventListener('click', (e) => { e.preventDefault(); goToTab('social'); });
  $('claimBonusBtn').addEventListener('click', () => claimDailyBonus(currentCurrency, EXCHANGE_RATES));
  $('searchBar').addEventListener('keyup', handleSearch);
  $('groupGrid').addEventListener('click', handleGameCardClick); 
  $('homeFeaturedGames').addEventListener('click', handleGameCardClick);
  $('detailBackBtn').addEventListener('click', () => history.back());
  $('home-promo-list').addEventListener('click', (e) => handleLikeClick(e, currentUser));
  $('social-list-container').addEventListener('click', (e) => handleLikeClick(e, currentUser));
  $('openTopup').addEventListener('click', () => openTopupModal(currentCurrency, EXCHANGE_RATES));
  
  $('refreshBtn').addEventListener('click', () => {
    updateBalanceAmount(currentUser, currentCurrency, EXCHANGE_RATES, formatCurrency);
    lastVisibleTransaction = null;
    loadTransactions(false);
  });
  
  $('currencySelect').addEventListener('change', saveCurrencySetting);
  $('editProfileBtn').addEventListener('click', () => showProfileModal(true, currentUser));
  $('changePasswordBtn').addEventListener('click', showPasswordModal);
  $('aboutBtn').addEventListener('click', showAboutModal);
  $('buyConfirmBtn').addEventListener('click', confirmPurchase);
  $('profileSaveBtn').addEventListener('click', saveProfile);
  $('passwordSaveBtn').addEventListener('click', savePassword);
  $('topupNextBtn1').addEventListener('click', handleTopupNext1);
  $('topup-method-grid').addEventListener('click', handleTopupMethodSelect);
  $('topupSubmitRequestBtn').addEventListener('click', () => submitTopupRequest(selectedTopupAmount, selectedTopupMethod));
  $('buyCloseBtn').addEventListener('click', () => showBuyModal(false));
  $('profileCloseBtn').addEventListener('click', () => showProfileModal(false));
  $('passwordCloseBtn').addEventListener('click', () => showPasswordModal(false));
  $('aboutCloseBtn').addEventListener('click', () => showAboutModal(false));
  $('successCloseBtn').addEventListener('click', hidePurchaseSuccessModal);
  $('notificationCloseBtn').addEventListener('click', () => showNotificationModal(false));
  $('topupCloseBtn1').addEventListener('click', () => showTopupModal(false));
  $('topupCloseBtn2').addEventListener('click', () => showTopupModal(false));
  $('topupBackTo1Btn').addEventListener('click', () => navigateTopupStep(1));
  $('topupBackTo2Btn').addEventListener('click', () => navigateTopupStep(2));
  $('changePinBtn').addEventListener('click', changeTransactionPIN);

  const loadMoreBtn = $("loadMoreTxBtn");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => loadTransactions(true));
  }

  window.addEventListener('popstate', handlePopState);
  
  const filterGroup = $("txFilterGroup");
  if (filterGroup) {
    filterGroup.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-filter')) {
        handleTxFilterChange(e.target.dataset.filter);
      }
    });
  }
}

function init() {
  console.log("App initializing...");
  loadCurrencySetting();
  initScrollObserver();
  attachAllEventListeners();
  initAvatarSelector();
  listenForConfig(handleConfigUpdate); 
  listenForProducts(currentCurrency);
  listenForPromotions(currentUser, currentCurrency);
  listenForBanners();
  initAuthListener(); 
  handlePopState(); 
  hideLoader(); 
}

async function setupTransactionPIN(isForced = false) {
    if (!currentUser) return;

    const { value: pin } = await Swal.fire({
        title: isForced ? 'Welcome! Set PIN' : 'Set Transaction PIN',
        text: isForced 
            ? 'လုံခြုံရေးအတွက် PIN နံပါတ် ၆ လုံး စတင်သတ်မှတ်ပေးပါ' 
            : 'PIN နံပါတ်အသစ် ၆ လုံး ရိုက်ထည့်ပါ',
        input: 'password',
        inputAttributes: {
            maxlength: 6, 
            inputmode: 'numeric', 
            autocapitalize: 'off', 
            autocomplete: 'off' 
        },
        confirmButtonText: 'Save PIN',
        confirmButtonColor: '#00d2ff',
        showCancelButton: !isForced, 
        allowOutsideClick: !isForced, 
        allowEscapeKey: !isForced, 
        background: '#071433', color: '#fff',
        inputValidator: (value) => {
            if (!value || value.length !== 6 || isNaN(value)) {
                return 'ဂဏန်း ၆ လုံး တိတိ ဖြစ်ရပါမယ်!';
            }
        }
    });

    if (pin) {
        const hashedPin = CryptoJS.SHA256(pin).toString();
        try {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, {
                transactionPin: hashedPin,
                pinSetDate: new Date().toISOString()
            });
            
            await Swal.fire({
                title: 'Success', 
                text: 'PIN နံပါတ် သတ်မှတ်ပြီးပါပြီ!', 
                icon: 'success',
                background: '#071433', color: '#fff', confirmButtonColor: '#00d2ff'
            });
        } catch (error) {
            console.error(error);
            showToast("PIN Error: " + error.message, "error");
        }
    }
}

async function changeTransactionPIN() {
    if (!currentUser) return;
    if (!currentUser.transactionPin) {
        return setupTransactionPIN();
    }

    const { value: oldPin } = await Swal.fire({
        title: 'Change PIN',
        text: 'လက်ရှိ PIN နံပါတ်အဟောင်း ရိုက်ထည့်ပါ',
        input: 'password',
        inputAttributes: { maxlength: 6, inputmode: 'numeric' },
        confirmButtonText: 'Next',
        showCancelButton: true,
        background: '#071433', color: '#fff'
    });

    if (oldPin) {
        const oldHash = CryptoJS.SHA256(oldPin).toString();
        
        if (oldHash === currentUser.transactionPin) {
            await setupTransactionPIN(false); 
        } else {
            Swal.fire({
                title: 'Wrong PIN', text: 'PIN အဟောင်း မှားယွင်းနေပါတယ်', icon: 'error',
                background: '#071433', color: '#fff'
            });
        }
    }
}

async function verifyTransactionPIN() {
    if (!currentUser) return false;
    if (!currentUser.transactionPin) {
        await Swal.fire({
            title: 'Security Alert', text: 'PIN နံပါတ် အရင်သတ်မှတ်ပေးပါ', icon: 'warning',
            background: '#071433', color: '#fff'
        });
        await setupTransactionPIN(true);
        return false;
    }
    const { value: inputPin } = await Swal.fire({
        title: 'Confirm Purchase',
        text: 'အတည်ပြုရန် PIN ရိုက်ထည့်ပါ',
        input: 'password',
        inputAttributes: { maxlength: 6, inputmode: 'numeric' },
        confirmButtonText: 'Verify',
        showCancelButton: true,
        background: '#071433', color: '#fff'
    });
    if (inputPin) {
        const inputHash = CryptoJS.SHA256(inputPin).toString();
        if (inputHash === currentUser.transactionPin) return true;
        Swal.fire({ title: 'Wrong PIN', icon: 'error', background: '#071433', color: '#fff' });
    }
    return false;
}
function prepareInvoice(data) {
    const now = new Date();
    document.getElementById('inv-date').textContent = now.toLocaleDateString();
    document.getElementById('inv-time').textContent = now.toLocaleTimeString();
    document.getElementById('inv-id').textContent = "INV-" + Math.floor(100000 + Math.random() * 900000);
    document.getElementById('inv-item').textContent = data.itemName;
    document.getElementById('inv-userid').textContent = data.userId || '-';
    document.getElementById('inv-serverid').textContent = data.serverId || '-';
    document.getElementById('inv-amount').textContent = data.price;
    const loadingText = document.getElementById('invoice-loading');
    const previewImg = document.getElementById('invoice-preview-img');
    const downloadBtn = document.getElementById('downloadInvoiceBtn');
    
    loadingText.style.display = 'block';
    previewImg.style.display = 'none';
    downloadBtn.disabled = true; 

    const invoiceElement = document.getElementById('invoice-capture-area');
    
    html2canvas(invoiceElement, { scale: 2, backgroundColor: "#041227" }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        
        loadingText.style.display = 'none';
        previewImg.src = imgData;
        previewImg.style.display = 'block';
        downloadBtn.disabled = false; 

        const newBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);

        newBtn.addEventListener('click', () => {
            const link = document.createElement('a');
            link.download = `Faygo-Invoice-${Date.now()}.png`;
            link.href = imgData; 
            link.click();
            
            newBtn.textContent = "✅ Saved to Gallery";
            setTimeout(() => { newBtn.textContent = "📥 Save Invoice"; }, 2000);
        });
    });
}
const AVATARS = [
  "https://robohash.org/Felix?set=set1&bgset=bg1",
  "https://robohash.org/Chloe?set=set1&bgset=bg1",
  "https://robohash.org/Ryan?set=set1&bgset=bg1",
  "https://robohash.org/Bella?set=set1&bgset=bg1",
  "https://robohash.org/Gamer1?set=set2&bgset=bg1", 
  "https://robohash.org/Gamer2?set=set2&bgset=bg1",
  "https://robohash.org/ProPlayer?set=set3&bgset=bg1", 
  "https://robohash.org/Streamer?set=set3&bgset=bg1"
];

function initAvatarSelector() {
  const grid = $('avatar-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  AVATARS.forEach(url => {
    const img = document.createElement('img');
    img.src = url;
    img.style = "width: 50px; height: 50px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;";
    img.onclick = () => {
      grid.querySelectorAll('img').forEach(i => i.style.borderColor = "transparent");
      img.style.borderColor = "#00d2ff";
      $('selectedAvatarUrl').value = url;
    };
    grid.appendChild(img);
  });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBox = $('installAppContainer');
  if (installBox) installBox.style.display = 'flex';
  
  $('installAppBtn').addEventListener('click', () => {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        $('installAppContainer').style.display = 'none';
      }
      deferredPrompt = null;
    });
  });
});

document.addEventListener('DOMContentLoaded', init);