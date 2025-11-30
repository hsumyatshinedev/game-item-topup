let scrollObserver = null; 
let successModalTimer = null; 

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

export function playSound(type = 'click') {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (type === 'click') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);

  } else if (type === 'tab') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);

  } else if (type === 'success') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); 
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5); 
    osc.start(now);
    osc.stop(now + 1.5);
  }
}


export const $ = (id) => document.getElementById(id);

export function initScrollObserver() {
  scrollObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    }
  );
}

export function observeElement(element) {
  if (scrollObserver && element) {
    scrollObserver.observe(element);
  }
}

export function hideLoader() {
  const loader = $('loader-wrap');
  if (loader) {
    loader.style.opacity = '0';
    loader.style.visibility = 'hidden';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 500);
  }
}

export function showNotificationModal(show = true, unreadCount = 0, allNotifications = [], markAllNotificationsAsRead) {
  const wrap = $('notificationModalWrap');
  wrap.style.visibility = show ? 'visible' : 'hidden';
  wrap.style.opacity = show ? '1' : '0';

  if (show) {
    renderNotificationList(allNotifications); 
    if (unreadCount > 0) {
      markAllNotificationsAsRead(); 
    }
  }
}

export function renderNotificationList(allNotifications = []) {
  const container = $('notification-list-container');
  container.innerHTML = '';

  if (allNotifications.length === 0) {
    container.innerHTML = '<div class="muted" style="text-align: center; padding: 20px;">No notifications yet.</div>';
    return;
  }

  allNotifications.forEach(noti => {
    const notiDate = noti.createdAt?.toDate ? noti.createdAt.toDate() : new Date();
    const card = document.createElement('div');
    card.className = 'setting-row';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'flex-start';
    card.style.gap = '6px';

    if (noti.read === false) {
      card.style.background = "var(--glass)";
      card.style.borderColor = "var(--neon)";
    }

    const isApproved = noti.title.includes('Approved');
    const iconColor = isApproved ? 'var(--success)' : 'var(--error)';
    const iconSvg = isApproved
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
        ${iconSvg}
        <div style="font-weight:700; color: ${iconColor};">${noti.title}</div>
        <div class="muted" style="margin-left: auto; font-size: 11px;">
          ${notiDate.toLocaleDateString()}
        </div>
      </div>
      <div class="muted" style="font-size: 13px; line-height: 1.5; padding-left: 28px;">
        ${noti.message}
      </div>
    `;
    container.appendChild(card);
  });
}

export function renderNotificationBadge(unreadCount = 0) {
  const badge = $('notification-badge');
  if (unreadCount > 0) {
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

export function getPriceString(priceObject, currentCurrency) {
  if (!priceObject) return "N/A";

  const currency = currentCurrency.toLowerCase();

  let price = priceObject[currency];
  let displayCurrency = currentCurrency.toUpperCase();

  if (!price || price <= 0) {
    price = priceObject['usd'];
    displayCurrency = 'USD';
  }

  if (!price || price === Infinity) return "N/A";

  try {
    if (displayCurrency === 'USD') {
      return `$${price.toFixed(2)}`;
    } else if (displayCurrency === 'MMK') {
      return `${Math.round(price).toLocaleString('en-US')} Ks`;
    } else if (displayCurrency === 'THB') {
      return `฿${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    } else if (displayCurrency === 'MYR') {
      return `RM${price.toFixed(2)}`;
    } else {
      return `$${priceObject['usd'].toFixed(2)}`;
    }
  } catch (e) {
    console.error("Price formatting error", e);
    return `$${(priceObject['usd'] || 0).toFixed(2)}`;
  }
}

export function getPriceNumber(priceObject, currencyKey = 'usd') {
  if (!priceObject) return 0;
  return priceObject['usd'] || 0;
}

export function formatCurrency(usdAmount, targetCurrency, EXCHANGE_RATES = {}) {
  if (usdAmount === null || usdAmount === undefined) return "—";

  const rate = EXCHANGE_RATES[targetCurrency];
  if (!rate) return `$${usdAmount.toFixed(2)}`;

  const convertedAmount = usdAmount * rate;

  if (targetCurrency === 'USD') {
    return `$${convertedAmount.toFixed(2)}`;
  } else if (targetCurrency === 'MMK') {
    return `${Math.round(convertedAmount).toLocaleString('en-US')} Ks`;
  } else if (targetCurrency === 'THB') {
    return `฿${convertedAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  } else if (targetCurrency === 'MYR') {
    return `RM${convertedAmount.toFixed(2)}`;
  }
  return `$${usdAmount.toFixed(2)}`;
}

export function attachTabs(onTabClick) {
  const tabs = document.querySelectorAll('.tab');
  const indicator = $('tabIndicator');

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      const oldIndex = onTabClick(index); 
      if (oldIndex === index) return; 
      
      playSound('tab');

      document.querySelector('.tabs').style.display = 'flex';
      $('detailPane').classList.remove('show');

      indicator.style.transform = `translateX(${index * 100}%)`;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
}

export function goToTab(tabName) {
  const tabButton = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (tabButton) {
    tabButton.click();
  }
}

export function showAuth(show = true, showClose = true) {
  try {
    if (show) {
      $('app').style.display = 'none';
      $('authWrap').style.display = 'flex';
      $('closeAuth').style.display = showClose ? 'inline-block' : 'none';
      setAuthMsg('');
      showAuthView('login');
      $('email').value = '';
      $('password').value = '';
      $('displayName').value = '';
    } else {
      $('app').style.display = 'flex';
      $('authWrap').style.display = 'none';
    }
  } catch (e) {
    console.error("Error in showAuth:", e);
    document.body.innerHTML = 'A critical error occurred. Please check console.';
  }
}

export function showAuthView(view) {
  const title = $('authTitle');
  const subtitle = $('authSubtitle');
  const nameField = $('displayNameField');
  const passField = $('passwordField');
  const forgotLink = $('forgotPasswordLink').parentElement;
  const signinBtn = $('signinBtn');
  const signupBtn = $('signupBtn');
  const resetBtn = $('resetPasswordBtn');

  const toggleToSignup = $('toggleToSignup');
  const toggleToSignin = $('toggleToSignin');

  setAuthMsg('');

  if (view === 'login') {
    title.textContent = 'Sign in to Faygo';
    subtitle.textContent = 'Use email & password to continue.';
    nameField.style.display = 'none';
    passField.style.display = 'block';
    forgotLink.style.display = 'block';
    signinBtn.style.display = 'inline-block';
    signupBtn.style.display = 'none';
    resetBtn.style.display = 'none';
    toggleToSignup.style.display = 'inline-block';
    toggleToSignin.style.display = 'none';
  } else if (view === 'signup') {
    title.textContent = 'Create an Account';
    subtitle.textContent = 'Sign up to get your demo wallet.';
    nameField.style.display = 'block';
    passField.style.display = 'block';
    forgotLink.style.display = 'none';
    signinBtn.style.display = 'none';
    signupBtn.style.display = 'inline-block';
    resetBtn.style.display = 'none';
    toggleToSignup.style.display = 'none';
    toggleToSignin.style.display = 'inline-block';
  } else if (view === 'forgot') {
    title.textContent = 'Reset Password';
    subtitle.textContent = 'Enter your email to get a reset link.';
    nameField.style.display = 'none';
    passField.style.display = 'none';
    forgotLink.style.display = 'none';
    signinBtn.style.display = 'none';
    signupBtn.style.display = 'none';
    resetBtn.style.display = 'inline-block';
    toggleToSignup.style.display = 'none';
    toggleToSignin.style.display = 'inline-block';
  }
}

export function setAuthMsg(msg) {
  const el = $('authMsg');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

function getUserRank(totalSpentUSD = 0) {
  let rank = { name: "BRONZE", icon: "🥉", color: "#cd7f32" }; 

  if (totalSpentUSD >= 50) {
    rank = { name: "SILVER", icon: "🥈", color: "#c0c0c0" };
  }
  if (totalSpentUSD >= 200) {
    rank = { name: "GOLD", icon: "🥇", color: "#ffd700" };
  }
  if (totalSpentUSD >= 500) {
    rank = { name: "DIAMOND", icon: "💎", color: "#00d2ff" };
  }
  return rank;
}

export function renderHeaderUser(user) {
  const welcome = $('welcome');
  
  if (user && user.uid) {
    const displayName = user.displayName || user.name || 'User';
    const totalSpent = user.totalSpentUSD || 0;

    let rank = { name: "BRONZE", color: "#cd7f32" };
    if (totalSpent >= 50) rank = { name: "SILVER", color: "#c0c0c0" };
    if (totalSpent >= 200) rank = { name: "GOLD", color: "#ffd700" };
    if (totalSpent >= 500) rank = { name: "DIAMOND", color: "#00d2ff" };

    const avatarUrl = user.photoURL || "https://robohash.org/" + user.uid + "?set=set1&bgset=bg1";

    welcome.innerHTML = `
      <div style="display:flex; align-items:center; gap: 10px;">
        <img src="${avatarUrl}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid ${rank.color}; padding: 2px; background: #000;">
        <div>
          <div style="font-size: 10px; opacity: 0.9; color: ${rank.color}; letter-spacing: 1px; font-weight: 700;">
            ${rank.name}
          </div>
          <div style="font-size: 14px; font-weight: 700;">${displayName}</div>
        </div>
      </div>
    `;
    
    $('logoutBtn').style.display = 'inline-block';
  } else {
    welcome.textContent = 'Not signed in';
    $('logoutBtn').style.display = 'none';
  }
}

export function renderUser(user, renderHomeWelcome) {
  if(renderHomeWelcome) renderHomeWelcome(user);
}

export function showBuyModal(show = true) {
  $('buyModalWrap').style.visibility = show ? 'visible' : 'hidden';
  $('buyModalWrap').style.opacity = show ? '1' : '0';
}

export function showTopupModal(show = true, currentCurrency = 'USD', EXCHANGE_RATES = {}) {
  $('topupModalWrap').style.visibility = show ? 'visible' : 'hidden';
  $('topupModalWrap').style.opacity = show ? '1' : '0';
  if (show) {
    $('topupAmountInput').value = '';
    const currency = currentCurrency.toUpperCase();
    $('topupModalTitle').textContent = `Top-up Wallet`;
    $('topupStep1Title').textContent = `Step 1: Enter Amount`;
    $('topupAmountLabel').textContent = `Amount (${currency})`;
    const rateDisplay = $('topupConversionRate');
    if (currency !== 'USD') {
      const rate = EXCHANGE_RATES[currency] || 1;
      rateDisplay.textContent = `(Rate: $1 USD ≈ ${rate.toLocaleString('en-US')} ${currency})`;
    } else {
      rateDisplay.textContent = 'Your wallet balance is in USD.';
    }
    $('topup-method-grid').querySelectorAll('.pkg-item').forEach(i => i.classList.remove('selected'));
    $('slipUpload').value = null;
    $('slip-preview-img').src = '';
    $('slip-preview-img').style.display = 'none';
    $('slip-preview-text').style.display = 'block';
    $('slip-preview-text').textContent = 'No file selected';
    setTopupMsg('', 1);
    setTopupMsg('', 2);
    setTopupMsg('', 3);
    navigateTopupStep(1);
  }
}

export function navigateTopupStep(step) {
  $('topup-step-1').style.display = 'none';
  $('topup-step-2').style.display = 'none';
  $('topup-step-3').style.display = 'none';
  $('topup-footer-1').style.display = 'none';
  $('topup-footer-2').style.display = 'none';
  $('topup-footer-3').style.display = 'none';

  if (step === 1) {
    $('topup-step-1').style.display = 'block';
    $('topup-footer-1').style.display = 'flex';
  } else if (step === 2) {
    $('topup-step-2').style.display = 'block';
    $('topup-footer-2').style.display = 'flex';
  } else if (step === 3) {
    $('topup-step-3').style.display = 'block';
    $('topup-footer-3').style.display = 'flex';
  }
}

export function renderPaymentDetails(selectedTopupAmount, selectedTopupMethod, PAYMENT_INFO, formatCurrency, currentCurrency, EXCHANGE_RATES) {
  if (!selectedTopupAmount || !selectedTopupMethod) return;
  let phone = 'Not Set';
  if (selectedTopupMethod === 'KBZPay' && PAYMENT_INFO.KBZPay) {
    phone = PAYMENT_INFO.KBZPay;
  } else if (selectedTopupMethod === 'Wave' && PAYMENT_INFO.Wave) {
    phone = PAYMENT_INFO.Wave;
  }
  const detailsEl = $('payment-details');
  const userAmountString = formatCurrency(selectedTopupAmount, currentCurrency, EXCHANGE_RATES);
  const usdAmountString = formatCurrency(selectedTopupAmount, 'USD', EXCHANGE_RATES);
  detailsEl.innerHTML = `
    <div>ကျေးဇူးပြု၍ <b>${userAmountString}</b> (နှင့်ညီမျှသော <b>${usdAmountString}</b>) ကို အောက်ပါ account သို့ လွှဲပေးပါ။</div>
    <div class="payment-account">
      <span>${phone}</span>
      <button id="copyPhoneBtn" class="btn-secondary">Copy</button>
    </div>
    <div>Method: <b>${selectedTopupMethod}</b></div>
    <div style="margin-top: 8px; opacity: 0.8; font-size: 13px;">
      ငွေလွှဲပြီးပါက slip ဓာတ်ပုံကို အောက်တွင် ထည့်သွင်းပြီး Submit လုပ်ပါ။
    </div>
  `;
  $('copyPhoneBtn').addEventListener('click', (e) => {
    e.preventDefault();
    copyToClipboard(phone);
  });
}

export function copyToClipboard(text) {
  const helper = $('copy-helper');
  helper.value = text;
  helper.select();
  try {
    document.execCommand('copy');
    showToast('Phone number copied!', 'success');
  } catch (err) {
    showToast('Failed to copy', 'error');
  }
  helper.blur();
}

export function showProfileModal(show = true, user) {
  if (show && user) {
    $('profileName').value = user.displayName || user.name || '';
    setProfileMsg('');
  }
  $('profileModalWrap').style.visibility = show ? 'visible' : 'hidden';
  $('profileModalWrap').style.opacity = show ? '1' : '0';
}

export function showPasswordModal(show = true) {
  if (show) {
    $('newPassword').value = '';
    setPasswordMsg('');
  }
  $('passwordModalWrap').style.visibility = show ? 'visible' : 'hidden';
  $('passwordModalWrap').style.opacity = show ? '1' : '0';
}

export function showAboutModal(show = true) {
  $('aboutModalWrap').style.visibility = show ? 'visible' : 'hidden';
  $('aboutModalWrap').style.opacity = show ? '1' : '0';
}

export function setBuyMsg(msg) {
  const el = $('buyErrorMsg');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

export function setTopupMsg(msg, step = 3) {
  const el = $(`topupErrorMsg${step}`);
  if (el) {
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }
}

export function setProfileMsg(msg) {
  const el = $('profileErrorMsg');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

export function setPasswordMsg(msg) {
  const el = $('passwordErrorMsg');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

export function showPurchaseSuccessModal() {
  const wrap = $('successModalWrap');
  if (!wrap) return;
  if (successModalTimer){
     clearTimeout(successModalTimer);
  successModalTimer = null;
  }
  
  playSound('success'); 

  wrap.style.visibility = 'visible';
  wrap.style.opacity = '1';
}

export function hidePurchaseSuccessModal() {
  const wrap = $('successModalWrap');
  if (!wrap) return;
  if (successModalTimer) clearTimeout(successModalTimer);
  successModalTimer = null;
  wrap.style.opacity = '0';
  setTimeout(() => {
    wrap.style.visibility = 'hidden';
  }, 300);
}

export function renderTransactions(transactions, append = false, currentCurrency, EXCHANGE_RATES, formatCurrency, filter = 'all') {
  const list = $('transList');
  
  if (!append) {
    list.innerHTML = '';
  }

  if (!append && transactions.length === 0) {
    let emptyMsg = "ငွေလွှဲမှတ်တမ်းများ မရှိသေးပါ။"; 
    if (filter === 'purchase') {
      emptyMsg = "ဝယ်ယူမှု မှတ်တမ်းများ မရှိသေးပါ။"; 
    } else if (filter === 'topup') {
      emptyMsg = "ငွေဖြည့်မှု မှတ်တမ်းများ မရှိသေးပါ။"; 
    }
    
    list.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; opacity: 0.6;">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px;">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79zM15.5 8.5L8.5 15.5"></path>
        </svg>
        <div style="font-weight: 500;">${emptyMsg}</div>
      </div>
    `;
    return;
  }

  transactions.forEach(tx => {
    const el = document.createElement('div');
    el.className = 'trans-item';
    
    const isPending = tx.item.includes('(Pending)');
    const isRejected = tx.item.includes('(Rejected)'); 
    const isTopup = tx.type === 'topup';
    
    const left = document.createElement('div');
    let title = tx.type.charAt(0).toUpperCase() + tx.type.slice(1);
    if (isTopup) title = 'Top-up';
    if (tx.type === 'purchase') title = 'Purchase';
    if (tx.type === 'bonus') title = 'Bonus';
    
    left.innerHTML = `
      <div style="font-weight:700">${title}</div>
      <div class="muted" style="font-size: 12px;">
        ${tx.item.replace(' (Pending)', '').replace(' (Rejected)', '')} • ${new Date(tx.date).toLocaleDateString()}
      </div>
    `;
    
    const right = document.createElement('div'); 
    right.style.textAlign = 'right';
    
    let amountColor = '#fff'; 
    if (!isPending && !isRejected) {
      amountColor = tx.amount > 0 ? '#7cf1ff' : '#ff9a9a';
    } else if (isRejected) {
      amountColor = 'var(--error)';
    }
    
    const amountString = formatCurrency(Math.abs(tx.amount), currentCurrency, EXCHANGE_RATES);
    
    right.innerHTML = `
      <div style="font-weight:700; color: ${amountColor}">
        ${tx.amount > 0 ? '+' : '−'}${amountString}
        ${isPending ? '<span class="pending-badge">PENDING</span>' : ''}
        ${isRejected ? '<span class="pending-badge" style="background:var(--error)">REJECTED</span>' : ''}
      </div>
      <div class="muted" style="font-size: 11px;">${tx.id}</div>
    `;
    
    el.appendChild(left);
    el.appendChild(right);
    list.appendChild(el); 
  });
}

export function updateBalanceAmount(user, currentCurrency, EXCHANGE_RATES, formatCurrency) {
  const balanceLabel = $('balanceLabel');
  const balanceAmount = $('balanceAmount');
  
  if (user) {
    balanceLabel.textContent = `Balance (${currentCurrency})`;
    balanceAmount.textContent = formatCurrency(user.balance, currentCurrency, EXCHANGE_RATES);
  } else {
    balanceLabel.textContent = 'Balance';
    balanceAmount.textContent = '—';
  }
}



export function openTopupModal(currentCurrency, EXCHANGE_RATES) {
  showTopupModal(true, currentCurrency, EXCHANGE_RATES); 
}

export function showToast(message, type = 'default') {
  const container = $('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-item';
  toast.innerHTML = message;
  if (type === 'success') toast.classList.add('success');
  else if (type === 'error') toast.classList.add('error');
  container.appendChild(toast);
  
  playSound('click');

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 300);
  }, 2700);
}

export function createPromoCard(promo, promoId, currentUser, onCommentClick) {
  const card = document.createElement('div');
  card.className = 'promo-card'; 
  card.classList.add('scroll-animate'); 
  
  let imageHtml = '';
  if (promo.image) {
    imageHtml = `<div class="promo-image" style="background-image: url('${promo.image}')"></div>`;
  }
  
  const likes = promo.likes || [];
  const likeCount = likes.length;
  const isLiked = currentUser ? likes.includes(currentUser.uid) : false;
  const commentCount = promo.commentCount || 0; 
  
  const heartIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
  const messageIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`;

  card.innerHTML = `         
    ${imageHtml}
    <div class="promo-content">
      <div class="promo-title">${promo.title || 'New Promotion'}</div>
      <div class="promo-desc">${promo.description || 'Check it out!'}</div>
    </div>
    <div class="promo-footer">
      <button class="like-btn ${isLiked ? 'active' : ''}" data-promo-id="${promoId}">
        ${heartIcon}
        <span>${isLiked ? 'Liked' : 'Like'}</span>
      </button>
      <span class="like-count" style="margin-right: 15px;">${likeCount}</span>
      
      <button class="like-btn comment-btn" data-promo-id="${promoId}">
        ${messageIcon}
        <span>Comment</span>
      </button>
    </div>
  `;
  
  const commentBtn = card.querySelector('.comment-btn');
  if (commentBtn && onCommentClick) {
    commentBtn.addEventListener('click', () => onCommentClick(promoId, promo.title));
  }

  return card;
}

export function showCommentModal(show = true, promoTitle = '', comments = [], onPostComment) {
  let modal = $('commentModalWrap');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'commentModalWrap';
    modal.className = 'auth-wrap';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
    modal.style.zIndex = '102';
    
    modal.innerHTML = `
      <div class="auth-card" style="height: 80vh; display: flex; flex-direction: column;">
        <h2 id="commentModalTitle">Comments</h2>
        <button id="commentCloseBtn" class="btn-secondary" style="position: absolute; top: 15px; right: 15px; padding: 6px 10px;">&times;</button>
        
        <div id="commentList" style="flex-grow: 1; overflow-y: auto; margin: 10px 0; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
          <div class="muted" style="text-align: center;">No comments yet.</div>
        </div>
        
        <div style="margin-top: auto; display: flex; gap: 8px;">
          <input id="commentInput" type="text" placeholder="Write a comment..." style="flex-grow: 1; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white;">
          <button id="commentSendBtn" class="btn" style="padding: 0 14px;">Send</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelector('#commentCloseBtn').addEventListener('click', () => {
      modal.style.opacity = '0';
      modal.style.visibility = 'hidden';
    });
  }
  
  if (show) {
    $('commentModalTitle').textContent = `Comments: ${promoTitle}`;
    const list = $('commentList');
    list.innerHTML = '';
    
    if (comments.length === 0) {
      list.innerHTML = '<div class="muted" style="text-align: center; margin-top: 20px;">No comments yet. Be the first!</div>';
    } else {
      comments.forEach(c => {
        const item = document.createElement('div');
        item.style.marginBottom = '12px';
        const timeString = c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString() : 'Just now';
        item.innerHTML = `
          <div style="font-size: 13px; font-weight: 700; color: var(--accent); margin-bottom: 2px;">${c.userName || 'User'} <span class="muted" style="font-weight: 400; font-size: 11px;">• ${timeString}</span></div>
          <div style="font-size: 14px; line-height: 1.4;">${c.text}</div>
        `;
        list.appendChild(item);
      });
      setTimeout(() => list.scrollTop = list.scrollHeight, 100);
    }
    
    const sendBtn = $('commentSendBtn');
    const input = $('commentInput');
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
    
    newSendBtn.addEventListener('click', () => {                                                    
      const text = input.value.trim();
      if (text && onPostComment) {
        onPostComment(text);
        input.value = '';
      }
    });
    
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
  } else {
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
  }
}
  