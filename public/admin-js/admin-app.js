import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { 
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut,
  getIdTokenResult 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { 
  getFirestore, doc, setDoc, getDoc, updateDoc, addDoc, collection, 
  onSnapshot, runTransaction, serverTimestamp, deleteDoc,
  query, where, orderBy, limit, 
  documentId,getDocs
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBDaCq64baSoA8UIBpHC0XhztZIYR939bI",
  authDomain: "webapp-bcb37.firebaseapp.com",
  projectId: "webapp-bcb37", 
  storageBucket: "webapp-bcb37.firebasestorage.app",
  messagingSenderId: "666038503161",
  appId: "1:666038503161:web:627221bf0e839c26db8428",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const $ = (id) => document.getElementById(id);

let topupUnsubscribe = null;
let historyUnsubscribe = null; 
let userUnsubscribe = null;
let productUnsubscribe = null; 
let promoUnsubscribe = null; 
let settingsUnsubscribe = null; 
let bannerUnsubscribe = null; 
let dashboardUnsubscribe = null; 
let currentProductOptions = [];
let currentEditProductId = null;
let currentEditPromoId = null;
let confirmResolve = null;

function showCustomAlert(message) {
  return new Promise((resolve) => {
    $("alert-msg").textContent = message;
    $("alert-modal").style.display = "flex";
    $("alert-ok-btn").onclick = () => {
      $("alert-modal").style.display = "none";
      resolve(true);
    };
  });
}

function showCustomConfirm(message) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    $("confirm-msg").textContent = message;
    $("confirm-modal").style.display = "flex";
  });
}

$("confirm-yes-btn").addEventListener("click", () => {
  $("confirm-modal").style.display = "none";
  if (confirmResolve) confirmResolve(true);
});

$("confirm-no-btn").addEventListener("click", () => {
  $("confirm-modal").style.display = "none";
  if (confirmResolve) confirmResolve(false);
});

if ($("adminLikeCloseBtn")) {
    $("adminLikeCloseBtn").addEventListener("click", closeAdminLikeModal);
}

function setupAdminLogin() {
  $("login-btn").addEventListener("click", () => {
    const email = $("admin-user").value;
    const pass = $("admin-pass").value;
    if (!email || !pass) {
      $("login-msg").textContent = "Please enter both username and password.";
      return;
    }
    $("login-msg").textContent = "Logging in...";
    $("login-btn").disabled = true;
    loginToFirebase(email, pass);
  });
}

async function loginToFirebase(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const tokenResult = await getIdTokenResult(user, true);
    if (tokenResult.claims.admin === true) {
      $("login-msg").textContent = "Admin login successful!";
    } else {
      $("login-msg").textContent = "You do not have permission to access this panel.";
      await signOut(auth); 
      $("login-btn").disabled = false;
    }
  } catch (err) {
    console.error("Firebase login error:", err);
    $("login-msg").textContent = `Firebase Login Failed: ${err.code}.`;
    $("login-btn").disabled = false;
  }
}

function setupLogoutButton() {
  const logoutBtn = $("logout-btn");
  if (!logoutBtn || logoutBtn.dataset.listenerAttached) return; 
  logoutBtn.addEventListener("click", async () => {
    const confirmed = await showCustomConfirm("Are you sure you want to log out?");
    if (confirmed) {
      try {
        await signOut(auth);
      } catch (err) {
        console.error("Logout failed:", err);
        await showCustomAlert("Logout failed: " + err.message);
      }
    }
  });
  logoutBtn.dataset.listenerAttached = "true"; 
}

function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  $("dashboard-page").classList.add("active");
  document.querySelector('.tab-btn[data-tab="dashboard"]').classList.add("active");
  feather.replace();
  $("tab-bar").addEventListener("click", (e) => {
    const tabButton = e.target.closest(".tab-btn");
    if (!tabButton) return;
    const tabName = tabButton.dataset.tab;
    tabButtons.forEach(btn => btn.classList.remove("active"));
    tabButton.classList.add("active");
    tabContents.forEach(content => {
      if (content.id === `${tabName}-page`) {
        content.classList.add("active");
      } else {
        content.classList.remove("active");
      }
    });
    feather.replace();
  });
}

function loadUserList(searchTerm = '') {
  if (userUnsubscribe) userUnsubscribe();
  
  const usersRef = collection(db, "users");
  let userQueryConstraints = [orderBy("name", "asc")];
  
  const term = searchTerm.toLowerCase().trim();
  
  
  userUnsubscribe = onSnapshot(usersRef, (snapshot) => {
    
    const tbody = $("user-table").querySelector("tbody");
    tbody.innerHTML = ""; 
    
    const filteredUsers = [];
    snapshot.forEach((doc) => {
      const user = doc.data();
      const userName = user.name ? user.name.toLowerCase() : '';
      const userEmail = user.email ? user.email.toLowerCase() : '';
      
      if (!term || userName.includes(term) || userEmail.includes(term)) {
        filteredUsers.push({ id: doc.id, ...user });
      }
    });

    if (filteredUsers.length === 0) {
       tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; opacity: 0.7;">No users found.</td></tr>';
       return;
    }
    
    filteredUsers.forEach((user) => {
      const tr = document.createElement("tr");
      tr.dataset.id = user.id;
      tr.innerHTML = `
        <td>
          ${user.name || 'N/A'}
          <div class="text-muted">${user.email}</div>
        </td>
        <td><b>$${(user.balance || 0).toFixed(2)}</b></td>
        <td style="display: flex; gap: 8px; align-items: center;">
          <button class="btn btn-sm" data-action="edit-balance">Set Balance</button>
          <button class="btn btn-sm btn-danger" data-action="delete-user" style="display: inline-flex; align-items: center; gap: 4px;">
            <i data-feather="trash-2" style="width: 14px; height: 14px;"></i>
            Delete
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    feather.replace();
  });
}

function listenForDashboardData() {
  if (dashboardUnsubscribe) dashboardUnsubscribe();
  
  const usersRef = collection(db, "users");
  const topupRef = collection(db, "topupRequests");
  
  userUnsubscribe = onSnapshot(usersRef, (snapshot) => {
    let totalUsers = snapshot.size;
    let totalBalance = 0;
    
    snapshot.forEach(doc => {
      totalBalance += doc.data().balance || 0;
    });
    
    $("totalUsersValue").textContent = totalUsers;
    $("totalBalanceValue").textContent = `$${totalBalance.toFixed(2)}`;
    
    if ($("user-search-input") && $("user-search-input").value.trim() === '') {
      const tbody = $("user-table").querySelector("tbody");
      tbody.innerHTML = "";
      if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; opacity: 0.7;">No users found.</td></tr>';
        return;
      }
      snapshot.forEach((doc) => {
        const user = doc.data();
        const tr = document.createElement("tr");
        tr.dataset.id = doc.id;
        const banBtnColor = user.isBanned ? "btn-success" : "btn-pending"; 
const banBtnText = user.isBanned ? "Unban" : "Ban";
const rowColor = user.isBanned ? "style='opacity: 0.5; background: rgba(255,0,0,0.1);'" : "";

tr.innerHTML = `
  <td ${rowColor}>
    ${user.name || 'N/A'} ${user.isBanned ? '<b style="color:red;">(BANNED)</b>' : ''}
    <div class="text-muted">${user.email}</div>
  </td>
  <td ${rowColor}><b>$${(user.balance || 0).toFixed(2)}</b></td>
  <td style="display: flex; gap: 8px; align-items: center;">
    <button class="btn btn-sm" data-action="edit-balance">Set Balance</button>
    
    <button class="btn btn-sm ${banBtnColor}" data-action="toggle-ban" style="min-width: 60px;">
      ${banBtnText}
    </button>

    <button class="btn btn-sm btn-danger" data-action="delete-user">
      <i data-feather="trash-2" style="width: 14px; height: 14px;"></i>
    </button>
  </td>
`;
        tbody.appendChild(tr);
      });
      feather.replace();
    }
  });
  
  const pendingQuery = query(topupRef, where("status", "==", "pending"));

  topupUnsubscribe = onSnapshot(pendingQuery, (snapshot) => {
    let pendingCount = snapshot.size;
    let pendingValue = 0;
    
    const tbody = $("topup-table").querySelector("tbody");
    tbody.innerHTML = ""; 
    let hasPending = false;
    
    snapshot.forEach((doc) => {
      const request = doc.data();
      pendingValue += request.amount || 0; 
      hasPending = true;
      const tr = document.createElement("tr");
      tr.dataset.id = doc.id;
      tr.innerHTML = `
        <td>
          ${request.email || 'N/A'}
          <div class="text-muted">${request.userId}</div>
        </td>
        <td class="text-success">$${(request.amount || 0).toFixed(2)}</td>
        <td>${request.method}</td>
        <td>
          <img src="${request.slipImageUrl || request.slipBase64}" class="slip-img" alt="Slip" />
        </td>
        <td>
          <button class="btn btn-sm btn-success" data-action="approve">Approve</button>
          <button class="btn btn-sm btn-danger" data-action="reject">Reject</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    $("pendingTopupsCount").textContent = pendingCount;
    $("pendingTopupsValue").textContent = `$${pendingValue.toFixed(2)}`;
    
    if (!hasPending) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; opacity: 0.7;">No pending requests.</td></tr>';
    }
  });

  const historyQuery = query(
    topupRef, 
    where("status", "!=", "pending"), 
    orderBy("status"), 
    orderBy("createdAt", "desc"), 
    limit(50) 
  );
  
  if (historyUnsubscribe) historyUnsubscribe();
  historyUnsubscribe = onSnapshot(historyQuery, (snapshot) => {
    const tbody = $("history-table").querySelector("tbody");
    tbody.innerHTML = "";
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; opacity: 0.7;">No approved or rejected requests found.</td></tr>';
      return;
    }
    
    snapshot.forEach((doc) => {
      const request = doc.data();
      const statusClass = request.status === 'approved' ? 'approved' : 'rejected';
      const statusDisplay = request.status.charAt(0).toUpperCase() + request.status.slice(1);
      const date = request.createdAt && request.createdAt.toDate ? request.createdAt.toDate().toLocaleDateString() : 'N/A';
      
      const tr = document.createElement("tr");
      tr.dataset.id = doc.id;
      tr.innerHTML = `
        <td>${date}</td>
        <td>
          ${request.email || 'N/A'}
          <div class="text-muted">${request.userId}</div>
        </td>
        <td class="text-success">$${request.amount ? request.amount.toFixed(2) : '0.00'}</td>
        <td>${request.method}</td>
        <td><span class="status-badge ${statusClass}">${statusDisplay}</span></td>
        <td style="white-space: pre-wrap; min-width: 200px;">${request.adminNote || 'N/A'}</td>
      `;
      tbody.appendChild(tr);
    });
  });
}

function loadDashboardData(user) {
  $("admin-name").textContent = user.email;
  
  listenForDashboardData(); 
  listenForSettings();
  listenForBanners();
  const productsCollection = collection(db, "products");
  productUnsubscribe = onSnapshot(productsCollection, (snapshot) => {
    const tbody = $("product-table").querySelector("tbody");
    tbody.innerHTML = "";
    if (snapshot.empty) {
       tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; opacity: 0.7;">No products found.</td></tr>';
       return;
    }
    snapshot.forEach((doc) => {
      const product = doc.data();
      const optionsHtml = (product.options || [])
        .map(opt => {
          const prices = [
            `USD: <b>${opt.price.usd || 0}</b>`,
            `MMK: <b>${opt.price.mmk || 0}</b>`,
            `THB: <b>${opt.price.thb || 0}</b>`,
            `MYR: <b>${opt.price.myr || 0}</b>`
          ].join(' / ');
          return `<div style="margin-bottom: 5px; padding-bottom: 5px; border-bottom: 1px dashed var(--glass);">
            <b>${opt.name}</b><br><small>${prices}</small>
          </div>`;
        })
        .join('');
      const tr = document.createElement("tr");
      tr.dataset.id = doc.id;
      tr.innerHTML = `
        <td>
          <img src="${product.image || 'https://placehold.co/100x100/071433/7cf1ff?text=No+Img'}" class="product-img" alt="Product" />
        </td>
        <td>${product.groupDisplayName || '<i class="text-danger">N/A</i>'}</td>
        <td>${product.group || '<i class="text-danger">N/A</i>'}</td>
        <td>${product.name}</td>
        <td>${product.requiresServerId ? '<b class="text-success">Yes</b>' : 'No'}</td>
        <td style="white-space: normal; min-width: 250px;">${optionsHtml || 'No options'}</td>
        <td>
          <button class="btn btn-sm btn-secondary" data-action="edit-product" style="margin-right: 5px;">Edit</button>
          <button class="btn btn-sm btn-danger" data-action="delete-product">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
  
  const promosCollection = collection(db, "promotions");
  promoUnsubscribe = onSnapshot(promosCollection, (snapshot) => {
    const tbody = $("promo-table").querySelector("tbody");
    tbody.innerHTML = ""; 
    if (snapshot.empty) {
       tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; opacity: 0.7;">No promotions found.</td></tr>';
       return;
    }
    snapshot.forEach((doc) => {
      const promo = doc.data();
      const tr = document.createElement("tr");
      tr.dataset.id = doc.id;
      const likes = promo.likes || [];
      tr.innerHTML = `
        <td>
          <img src="${promo.image || 'https://placehold.co/100x100/071433/7cf1ff?text=No+Img'}" class="product-img" alt="Promo" />
        </td>
        <td>${promo.title}</td>
        <td style="white-space: pre-wrap; min-width: 200px;">${promo.description}</td>
        <td>
          <button class="btn btn-sm btn-secondary" data-action="view-likes">
            ${likes.length} Likes
          </button>
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" data-action="edit-promo" style="margin-right: 5px;">Edit</button>
          <button class="btn btn-sm btn-danger" data-action="delete-promo">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
}

$("topup-table").addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  const tr = e.target.closest("tr");
  if (!tr || !tr.dataset.id) return;
  const requestId = tr.dataset.id;
  if (action === "approve") {
    approveTopup(requestId);
  } else if (action === "reject") {
    const reason = prompt("Reason for rejection (This will be sent to the user):", "Slip image is unclear.");
    if (reason) { 
      rejectTopup(requestId, reason);
    } else {
      console.log("Reject cancelled by admin.");
    }
  }
});
$("user-table").addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  const tr = e.target.closest("tr");
  if (!tr || !tr.dataset.id) return;
  const userId = tr.dataset.id;
  const userEmail = tr.querySelector(".text-muted").textContent;
  if (action === "edit-balance") {
    const newBalance = prompt(`Enter new balance for user ${userEmail}:`);
    if (newBalance !== null && !isNaN(parseFloat(newBalance))) {
      setUserBalance(userId, parseFloat(newBalance));
    }
  } else if (action === "delete-user") {
    deleteUser(userId, userEmail);
  }
  if (action === "edit-balance") {
  } else if (action === "delete-user") {
    deleteUser(userId, userEmail);
  } 
  
  else if (action === "toggle-ban") {
    const isBanned = e.target.textContent.trim() === "Unban";
    toggleUserBan(userId, userEmail, !isBanned);
  }
});
$("product-table").addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  const tr = e.target.closest("tr");
  if (!tr || !tr.dataset.id) return;
  if (action === "delete-product") {
    deleteProduct(tr.dataset.id);
  } else if (action === "edit-product") {
    loadProductForEdit(tr.dataset.id);
  }
});
$("promo-table").addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  const tr = e.target.closest("tr");
  if (!tr || !tr.dataset.id) return;
  const promoId = tr.dataset.id;
  const promoTitle = tr.cells[1].textContent;
  if (action === "delete-promo") {
    deletePromotion(promoId); 
  } else if (action === "edit-promo") {
    loadPromoForEdit(promoId); 
  } else if (action === "view-likes") {
    openAdminLikeModal(promoId, promoTitle); 
  }
});
$("banner-table").addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  const tr = e.target.closest("tr");
  if (!tr || !tr.dataset.id || action !== "delete-banner") return;
  deleteBanner(tr.dataset.id);
}); 
document.body.addEventListener("click", (e) => {
  if (e.target.classList.contains("slip-img") || e.target.classList.contains("product-img")) {
    $("modal-img-src").src = e.target.src;
    $("image-modal").style.display = "flex";
  }
});
$("image-modal").addEventListener("click", () => {
  $("image-modal").style.display = "none";
});

async function approveTopup(requestId) {
  const confirmed = await showCustomConfirm("Are you sure you want to approve this request?");
  if (!confirmed) return;
  const requestRef = doc(db, "topupRequests", requestId);
  try {
    await runTransaction(db, async (transaction) => {
      const requestDoc = await transaction.get(requestRef);
      if (!requestDoc.exists() || requestDoc.data().status !== 'pending') {
        throw new Error("Request not found or already processed.");
      }
      const request = requestDoc.data();
      const userId = request.userId;
      const amount = request.amount;
      const userRef = doc(db, "users", userId);
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error(`User with ID ${userId} not found.`);
      }
      const userData = userDoc.data();
      const newBalance = (userData.balance || 0) + amount;
      transaction.update(userRef, { balance: newBalance });
      if (request.pendingTxId) {
        const txRef = doc(db, "users", userId, "transactions", request.pendingTxId);
        transaction.update(txRef, {
          item: `${request.method} (Approved)`
        });
      }
      transaction.update(requestRef, { status: "approved", adminNote: "Approved successfully.", processedAt: serverTimestamp() });
    });
    const requestData = (await getDoc(requestRef)).data();
    await createNotification(requestData.userId, "Top-up Approved", `Your top-up request for $${requestData.amount.toFixed(2)} was successfully approved.`);
    await showCustomAlert("Top-up approved successfully!");
  } catch (err) {
    console.error("Approve transaction failed: ", err);
    await showCustomAlert("Error approving top-up: " + err.message);
  }
}
async function rejectTopup(requestId, reasonStr) {
  const confirmed = await showCustomConfirm("Are you sure you want to REJECT this request?");
  if (!confirmed) return;
  const requestRef = doc(db, "topupRequests", requestId);
  try {
    await updateDoc(requestRef, { 
      status: "rejected", 
      adminNote: reasonStr, 
      processedAt: serverTimestamp() 
    }); 
    const request = (await getDoc(requestRef)).data();
    if (request.userId && request.pendingTxId) {
      const txRef = doc(db, "users", request.userId, "transactions", request.pendingTxId);
      await updateDoc(txRef, {
        item: `${request.method} (Rejected)`
      });
    }
    await createNotification(request.userId, "Top-up Rejected", `Reason: ${reasonStr}`);
    await showCustomAlert("Request rejected.");
  } catch (err) {
    console.error("Reject failed: ", err);
    await showCustomAlert("Error rejecting top-up: " + err.message);
  }
}
async function setUserBalance(userId, newBalance) {
  const userRef = doc(db, "users", userId);
  try {
    await updateDoc(userRef, { balance: newBalance });
    await showCustomAlert("User balance updated.");
  } catch (err) {
    console.error("Set balance failed: ", err);
    await showCustomAlert("Error setting balance: " + err.message);
  }
}
async function deleteUser(userId, userEmail) {
  const confirmed = await showCustomConfirm(`Are you sure you want to delete user '${userEmail}'? This will permanently delete their data (balance, history). This action cannot be undone.`);
  if (!confirmed) return;
  const userRef = doc(db, "users", userId);
  try {
    await deleteDoc(userRef);
    await showCustomAlert("User data deleted successfully. (Note: Sub-collections may still exist)");
  } catch (err) {
    console.error("Delete user failed: ", err);
    await showCustomAlert("Error deleting user data: " + err.message);
  }
}

async function loadProductForEdit(productId) {
  try {
    const productRef = doc(db, "products", productId);
    const docSnap = await getDoc(productRef);
    if (!docSnap.exists()) {
      return showCustomAlert("Error: Product not found.");
    }
    const product = docSnap.data();
    
    $("product-group-display-name").value = product.groupDisplayName || "";
    $("product-group").value = product.group || "";
    $("product-name").value = product.name || "";
    $("product-require-serverid").checked = product.requiresServerId || false;

    const iconPreview = $("product-image-preview");
    const iconHiddenUrl = $("product-image-url-hidden");
    if (product.image) {
      iconPreview.src = product.image;
      iconPreview.style.display = 'block';
      iconHiddenUrl.value = product.image;
    } else {
      iconPreview.style.display = 'none';
      iconHiddenUrl.value = "";
    }
    $("product-image").value = ""; 
    const bannerPreview = $("product-group-banner-preview");
    const bannerHiddenUrl = $("product-group-banner-url-hidden");
    if (product.groupBanner) {
      bannerPreview.src = product.groupBanner;
      bannerPreview.style.display = 'block';
      bannerHiddenUrl.value = product.groupBanner;
    } else {
      bannerPreview.style.display = 'none';
      bannerHiddenUrl.value = "";
    }
    $("product-group-banner").value = ""; 
    
    currentProductOptions = product.options || [];
    renderProductOptions(); 
    
    currentEditProductId = productId;
    
    $("save-product-btn").textContent = "Update Product";
    $("save-product-btn").classList.add("btn-success"); 
    
    if (!$("cancel-product-edit-btn")) {
      const cancelBtn = document.createElement('button');
      cancelBtn.id = "cancel-product-edit-btn";
      cancelBtn.className = "btn btn-secondary";
      cancelBtn.textContent = "Cancel Edit";
      cancelBtn.style.marginTop = "10px";
      cancelBtn.type = "button"; 
      cancelBtn.onclick = resetProductForm;
      $("save-product-btn").after(cancelBtn);
    }
    
    $("products-page").querySelector('.card').scrollIntoView({ behavior: 'smooth' });
    
  } catch (err) {
    console.error("Error loading product:", err);
    showCustomAlert("Error: " + err.message);
  }
}

function resetProductForm() {
  $("product-group-display-name").value = "";
  $("product-group").value = "";
  $("product-name").value = "";
  $("product-require-serverid").checked = false;
  $("product-image").value = ""; 
  $("product-group-banner").value = ""; 
  $("product-image-preview").src = "";
  $("product-image-preview").style.display = 'none';
  $("product-image-url-hidden").value = "";
  $("product-group-banner-preview").src = "";
  $("product-group-banner-preview").style.display = 'none';
  $("product-group-banner-url-hidden").value = "";
  
  currentProductOptions = [];
  renderProductOptions();
  currentEditProductId = null;
  $("save-product-btn").textContent = "Save Product"; 
  $("save-product-btn").classList.remove("btn-success"); 
  const cancelBtn = $("cancel-product-edit-btn");
  if (cancelBtn) cancelBtn.remove(); 
}

function setupProductForm() {

  $("add-option-btn").addEventListener("click", (e) => {
    e.preventDefault();
    const nameInput = $("product-option-name");
    const priceUSDInput = $("product-option-price-usd");
    const priceMMKInput = $("product-option-price-mmk");
    const priceTHBInput = $("product-option-price-thb");
    const priceMYRInput = $("product-option-price-myr");
    const skuInput = $("product-option-sku");
    const sku = skuInput.value.trim();
    const name = nameInput.value.trim();
    const priceUSD = parseFloat(priceUSDInput.value) || 0;
    const priceMMK = parseFloat(priceMMKInput.value) || 0;
    const priceTHB = parseFloat(priceTHBInput.value) || 0;
    const priceMYR = parseFloat(priceMYRInput.value) || 0;
    if (!name) {
      showCustomAlert("Please enter an option name.");
      return;
    }
    if (!sku) {
      showCustomAlert("Please enter the Smile.One Product ID (SKU).");
      return;
    }
    if (priceUSD <= 0) {
      showCustomAlert("Please enter a valid Price (USD) greater than 0.");
      return;
    }
    currentProductOptions.push({ 
      name, 
      sku: sku,
      price: {
       usd: priceUSD,
       mmk: priceMMK,
       thb: priceTHB,
       myr: priceMYR
      }
    });
    nameInput.value = "";
    priceUSDInput.value = "";
    priceMMKInput.value = "";
    priceTHBInput.value = "";
    priceMYRInput.value = "";
    skuInput.value = "";
    nameInput.focus();
    renderProductOptions();
  });
  
  $("save-product-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    
    const groupDisplayName = $("product-group-display-name").value.trim();
    const group = $("product-group").value.trim();
    const name = $("product-name").value.trim();
    const requiresServerId = $("product-require-serverid").checked;

    const iconFile = $("product-image").files[0];
    const bannerFile = $("product-group-banner").files[0];
    let iconUrl = $("product-image-url-hidden").value || "";
    let bannerUrl = $("product-group-banner-url-hidden").value || "";

    if (!groupDisplayName) return showCustomAlert("Please enter a Group Display Name.");
    if (!group) return showCustomAlert("Please enter a Group ID.");
    if (!name) return showCustomAlert("Please enter a Product Name (Tab Name).");
    if (currentProductOptions.length === 0) return showCustomAlert("Please add at least one price option.");

    const btn = $("save-product-btn");
    btn.disabled = true;
    
    try {
      if (iconFile) {
        btn.textContent = "Uploading Icon...";
        const timestamp = Date.now();
        const storageRef = ref(storage, `products/${group}_icon_${timestamp}-${iconFile.name}`);
        const uploadResult = await uploadBytes(storageRef, iconFile);
        iconUrl = await getDownloadURL(uploadResult.ref); 
      }

      if (bannerFile) {
        btn.textContent = "Uploading Banner...";
        const timestamp = Date.now();
        const storageRef = ref(storage, `products/${group}_banner_${timestamp}-${bannerFile.name}`);
        const uploadResult = await uploadBytes(storageRef, bannerFile);
        bannerUrl = await getDownloadURL(uploadResult.ref); 
      }
      
      btn.textContent = "Saving...";

      const productData = {
        name: name,
        group: group,
        groupDisplayName: groupDisplayName,
        groupBanner: bannerUrl, 
        image: iconUrl,       
        requiresServerId: requiresServerId,
        options: currentProductOptions
      };
      
      if (currentEditProductId) {
        const productRef = doc(db, "products", currentEditProductId);
        await setDoc(productRef, productData, { merge: true });
        showCustomAlert("Product updated successfully!");
      } else {
        await addDoc(collection(db, "products"), productData);
        showCustomAlert("Product saved successfully!");
      }
      
      resetProductForm();
      
    } catch (err) {
      console.error("Error saving product: ", err);
      showCustomAlert("Error saving product: " + err.message);
    } finally {
      btn.disabled = false;
    }
  });

  $("product-image").addEventListener("change", (e) => {
    const preview = $("product-image-preview");
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = function(event) {
        preview.src = event.target.result;
        preview.style.display = 'block';
        $("product-image-url-hidden").value = ""; 
      }
      reader.readAsDataURL(e.target.files[0]);
    } else {
      preview.src = "";
      preview.style.display = 'none';
    }
  });

  $("product-group-banner").addEventListener("change", (e) => {
    const preview = $("product-group-banner-preview");
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = function(event) {
        preview.src = event.target.result;
        preview.style.display = 'block';
        $("product-group-banner-url-hidden").value = ""; 
      }
      reader.readAsDataURL(e.target.files[0]);
    } else {
      preview.src = "";
      preview.style.display = 'none';
    }
  });
}

function renderProductOptions() {
  const list = $("product-options-list");
  list.innerHTML = "";
  if (currentProductOptions.length === 0) {
    list.innerHTML = '<div class="text-muted" style="text-align: center; padding: 10px;">No options added yet.</div>';
    return;
  }
  currentProductOptions.forEach((opt, index) => {
    const item = document.createElement("div");
    item.className = "option-item";
    item.innerHTML = `
      <div class="option-item-header">
        <span>${opt.name}</span>
        <button class="btn btn-sm btn-danger" data-index="${index}">&times;</button>
      </div>
      <div style="font-size: 11px; opacity: 0.7; margin-bottom: 8px; padding-left: 2px;">
        SKU: <b style="color:var(--pending);">${opt.sku || 'N/A'}</b>
      </div>
      <div class="option-item-prices">
        <div>USD: <b>${opt.price.usd}</b></div>
        <div>MMK: <b>${opt.price.mmk}</b></div>
        <div>THB: <b>${opt.price.thb}</b></div>
        <div>MYR: <b>${opt.price.myr}</b></div>
      </div>
    `;
    list.appendChild(item);
  });
  list.querySelectorAll(".btn-danger").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const indexToRemove = parseInt(e.target.dataset.index);
      currentProductOptions.splice(indexToRemove, 1); 
      renderProductOptions(); 
    });
  });
}
async function deleteProduct(productId) {
  const confirmed = await showCustomConfirm("Are you sure you want to permanently delete this product (tab)?");
  if (!confirmed) return;
  const productRef = doc(db, "products", productId);
  try {
    await deleteDoc(productRef);
    await showCustomAlert("Product deleted successfully.");
  } catch (err) {
    console.error("Delete product failed: ", err);
    await showCustomAlert("Error deleting product: " + err.message);
  }
}

async function loadPromoForEdit(promoId) {
  try {
    const promoRef = doc(db, "promotions", promoId);
    const docSnap = await getDoc(promoRef);
    if (!docSnap.exists()) {
      return showCustomAlert("Error: Promotion not found.");
    }
    const promo = docSnap.data();
    $("promo-title").value = promo.title || "";
    $("promo-desc").value = promo.description || "";
    
    const preview = $("promo-image-preview");
    const hiddenUrl = $("promo-image-url-hidden");
    if (promo.image) {
      preview.src = promo.image;
      preview.style.display = 'block';
      hiddenUrl.value = promo.image; 
    } else {
      preview.src = "";
      preview.style.display = 'none';
      hiddenUrl.value = "";
    }
    $("promo-image").value = ""; 
    
    currentEditPromoId = promoId;
    $("save-promo-btn").textContent = "Update Promotion";
    $("save-promo-btn").classList.add("btn-success");
    if (!$("cancel-promo-edit-btn")) {
      const cancelBtn = document.createElement('button');
      cancelBtn.id = "cancel-promo-edit-btn";
      cancelBtn.className = "btn btn-secondary";
      cancelBtn.textContent = "Cancel Edit";
      cancelBtn.style.marginTop = "10px";
      cancelBtn.type = "button";
      cancelBtn.onclick = resetPromoForm;
      $("save-promo-btn").after(cancelBtn);
    }
    $("social-page").querySelector('.card').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error("Error loading promotion:", err);
    showCustomAlert("Error: " + err.message);
  }
}

function resetPromoForm() {
  $("promo-title").value = "";
  $("promo-desc").value = "";
  
  $("promo-image-preview").src = "";
  $("promo-image-preview").style.display = 'none';
  $("promo-image-url-hidden").value = "";
  $("promo-image").value = ""; 
  
  currentEditPromoId = null;
  $("save-promo-btn").textContent = "Save Promotion"; 
  $("save-promo-btn").classList.remove("btn-success"); 
  const cancelBtn = $("cancel-promo-edit-btn");
  if (cancelBtn) cancelBtn.remove(); 
}

function setupPromoForm() {
  $("save-promo-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    const title = $("promo-title").value.trim();
    const imageFile = $("promo-image").files[0]; 
    const description = $("promo-desc").value.trim();
    
    if (!title || !description) {
      return showCustomAlert("Please enter a title and description.");
    }
    
    const btn = $("save-promo-btn");
    btn.disabled = true;
    let imageUrl = $("promo-image-url-hidden").value || ""; 

    try {
      if (imageFile) {
        btn.textContent = "Uploading Image...";
        const timestamp = Date.now();
        const storageRef = ref(storage, `promotions/${timestamp}-${imageFile.name}`);
        const uploadResult = await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(uploadResult.ref); 
      }
      
      btn.textContent = "Saving...";
      const promoData = {
        title,
        image: imageUrl, 
        description,
      };
      
      if (currentEditPromoId) {
        const promoRef = doc(db, "promotions", currentEditPromoId);
        await updateDoc(promoRef, promoData);
        showCustomAlert("Promotion updated successfully!");
      } else {
        promoData.createdAt = serverTimestamp();
        promoData.likes = [];
        await addDoc(collection(db, "promotions"), promoData);
        showCustomAlert("Promotion saved successfully!");
      }
      resetPromoForm();
    } catch (err) {
      console.error("Error saving promotion: ", err);
      showCustomAlert("Error saving promotion: " + err.message);
    } finally {
      btn.disabled = false;
    }
  });

  $("promo-image").addEventListener("change", (e) => {
    const preview = $("promo-image-preview");
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = function(event) {
        preview.src = event.target.result;
        preview.style.display = 'block';
        $("promo-image-url-hidden").value = ""; 
      }
      reader.readAsDataURL(e.target.files[0]);
    } else {
      preview.src = "";
      preview.style.display = 'none';
    }
  });
}

async function openAdminLikeModal(promoId, promoTitle) {
  const listContainer = $("adminLikeList");
  listContainer.innerHTML = '<p class="text-muted">Loading likes...</p>';
  $("adminLikeTitle").textContent = `Likes on "${promoTitle}"`;
  $("likeListModal").style.display = "flex";
  try {
    const promoRef = doc(db, "promotions", promoId);
    const promoSnap = await getDoc(promoRef);
    if (!promoSnap.exists()) {
      throw new Error("Promotion not found.");
    }
    const likesArray = promoSnap.data().likes || [];
    if (likesArray.length === 0) {
      listContainer.innerHTML = '<p class="text-muted">No likes found for this post.</p>';
      return;
    }
    const userMap = new Map();
    const batchSize = 30;
    for (let i = 0; i < likesArray.length; i += batchSize) {
        const batch = likesArray.slice(i, i + batchSize);
        const userQuery = query(collection(db, "users"), where(documentId(), 'in', batch));
        const userSnapshot = await getDocs(userQuery);
        userSnapshot.forEach(doc => {
            userMap.set(doc.id, doc.data());
        });
    }
    listContainer.innerHTML = '';
    if (userMap.size === 0) {
       listContainer.innerHTML = '<p class="text-muted">Liked users could not be found.</p>';
       return;
    }
    likesArray.forEach(uid => {
        const user = userMap.get(uid);
        const item = document.createElement('div');
        item.style = "background: var(--glass); padding: 8px 12px; border-radius: 8px; margin-bottom: 8px;";
        if (user) {
          item.innerHTML = `
            <b style="color: var(--neon); font-size: 14px;">${user.name || 'N/A'}</b>
            <span style="font-size: 13px; opacity: 0.8; margin-left: 10px;">(${user.email})</span>
          `;
        } else {
          item.innerHTML = `
            <b style="color: var(--error); font-size: 14px;">Unknown User</b>
            <span style="font-size: 13px; opacity: 0.8; margin-left: 10px;">(ID: ${uid})</span>
          `;
        }
        listContainer.appendChild(item);
    });
  } catch (err) {
    console.error("Error loading likes:", err);
    listContainer.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
  }
}
function closeAdminLikeModal() {
  $("likeListModal").style.display = "none";
}
async function deletePromotion(promoId) {
  const confirmed = await showCustomConfirm("Are you sure you want to delete this promotion?");
  if (!confirmed) return;
  const promoRef = doc(db, "promotions", promoId);
  try {
    await deleteDoc(promoRef);
    await showCustomAlert("Promotion deleted successfully.");
  } catch (err) {
    console.error("Delete promotion failed: ", err);
    await showCustomAlert("Error deleting promotion: " + err.message);
  }
}
function setupBannerForm() {
  $("banner-image").addEventListener("change", (e) => {
    const preview = $("banner-image-preview");
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = function(event) {
        preview.src = event.target.result;
        preview.style.display = 'block';
      }
      reader.readAsDataURL(e.target.files[0]);
    }
  });

  $("save-banner-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    const title = $("banner-title").value.trim(); 
    const imageFile = $("banner-image").files[0];
    
    if (!imageFile) return showCustomAlert("Please select an image file."); 
    
    const btn = $("save-banner-btn");
    btn.disabled = true;
    btn.textContent = "Uploading...";
    
    try {
      const timestamp = Date.now();
      const storageRef = ref(storage, `banners/banner_${timestamp}_${imageFile.name}`);
      const uploadResult = await uploadBytes(storageRef, imageFile);
      const imageUrl = await getDownloadURL(uploadResult.ref);

      await addDoc(collection(db, "heroBanners"), {
        title: title || "",
        imageUrl: imageUrl,
        type: "image", 
        createdAt: serverTimestamp()
      });
      
      showCustomAlert("Banner uploaded successfully!");
      $("banner-title").value = ""; 
      $("banner-image").value = "";
      $("banner-image-preview").style.display = 'none';
      
    } catch (err) {
      console.error("Error saving banner: ", err);
      showCustomAlert("Error: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "Upload & Save Banner";
    }
  });
}
function listenForBanners() {
  if (bannerUnsubscribe) bannerUnsubscribe();
  const bannersCollection = collection(db, "heroBanners");
  const bannerQuery = query(bannersCollection, orderBy("createdAt", "desc")); 
  bannerUnsubscribe = onSnapshot(bannerQuery, (snapshot) => {
    const tbody = $("banner-table").querySelector("tbody");
    tbody.innerHTML = ""; 
    if (snapshot.empty) {
       tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; opacity: 0.7;">No users found.</td></tr>';
       return;
    }
    snapshot.forEach((doc) => {
      const banner = doc.data();
      const tr = document.createElement("tr"); 
      tr.dataset.id = doc.id; 
      
      let contentHtml = '';
      if (banner.imageUrl) {
          contentHtml = `<img src="${banner.imageUrl}" style="width: 100px; height: 50px; object-fit: cover; border-radius: 6px;">`;
      } else {
          contentHtml = banner.text || 'No Content';
      }

      tr.innerHTML = `
        <td>${contentHtml}</td>
        <td><b>${banner.title || 'No Title'}</b></td>
        <td><button class="btn btn-sm btn-danger" data-action="delete-banner">Delete</button></td>
      `;
      tbody.appendChild(tr); 
    });
  });
}
async function deleteBanner(bannerId) {
  const confirmed = await showCustomConfirm("Are you sure you want to delete this banner?");
  if (!confirmed) return;
  const bannerRef = doc(db, "heroBanners", bannerId);
  try {
    await deleteDoc(bannerRef);
    await showCustomAlert("Banner deleted successfully.");
  } catch (err) {
    console.error("Error deleting banner:", err);
    await showCustomAlert("Error deleting banner: " + err.message);
  }
}
async function createNotification(userId, title, message) {
  try {
     await addDoc(collection(db, "notifications"), {
       userId: userId,
       title: title,
       message: message,
       read: false, 
       createdAt: serverTimestamp() 
     });
     console.log(`Notification created for user ${userId}`);
   } catch (err) {
     console.error("Error creating notification: ", err);
   }
}
function listenForSettings() {
  if (settingsUnsubscribe) settingsUnsubscribe();
  
  const configRef = doc(db, "config", "main");
  settingsUnsubscribe = onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      if($("kpay-number")) $("kpay-number").value = data.kpayNumber || "";
      if($("wave-number")) $("wave-number").value = data.waveNumber || "";

      if($("rate-mmk")) $("rate-mmk").value = data.rateMMK || "";
      if($("rate-thb")) $("rate-thb").value = data.rateTHB || "";
      if($("rate-myr")) $("rate-myr").value = data.rateMYR || "";

      if ($("maintenance-toggle")) {
        $("maintenance-toggle").checked = data.maintenanceMode || false;
      }
    }
  });
}
function setupSettingsForm() {
  const saveBtn = $("save-settings-btn");

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const btn = $("save-settings-btn");
      btn.disabled = true;
      btn.textContent = "Saving...";
      
      const maintenanceToggle = $("maintenance-toggle");
      const isMaintenanceOn = maintenanceToggle ? maintenanceToggle.checked : false;

      const settingsData = {
        kpayNumber: $("kpay-number").value.trim(),
        waveNumber: $("wave-number").value.trim(),
        rateMMK: parseFloat($("rate-mmk").value) || 0,
        rateTHB: parseFloat($("rate-thb").value) || 0,
        rateMYR: parseFloat($("rate-myr").value) || 0,
        maintenanceMode: isMaintenanceOn 
      };

      try {
        const configRef = doc(db, "config", "main");
        await setDoc(configRef, settingsData, { merge: true });
        
        await showCustomAlert("Settings saved successfully!"); 
        
      } catch (err) {
        console.error("Error saving settings:", err);
        await showCustomAlert("Error saving settings: " + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "Save Settings";
      }
    });
  } else {
    console.warn("⚠️ Save Button not found inside Settings Tab");
  }
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const tokenResult = await getIdTokenResult(user, true);
    if (tokenResult.claims.admin === true) {
      console.log("DEBUG: Auth state change: Admin confirmed.");
      $("login-wrap").style.display = "none";
      $("dashboard").style.display = "block";
      $("tab-content-container").style.display = "block";
      setupTabs(); 
      
      loadDashboardData(user);
      setupLogoutButton();
    } else {
      console.log("DEBUG: Auth state change: User is NOT admin. Logging out.");
      $("login-msg").textContent = "You do not have permission to access this panel.";
      await signOut(auth);
    }
  } else {
    console.log("DEBUG: Auth state change: User is signed out.");
    $("login-wrap").style.display = "flex";
    $("dashboard").style.display = "none";
    $("tab-content-container").style.display = "none";
    if (topupUnsubscribe) topupUnsubscribe();
    if (historyUnsubscribe) historyUnsubscribe(); 
    if (userUnsubscribe) userUnsubscribe();
    if (productUnsubscribe) productUnsubscribe(); 
    if (promoUnsubscribe) promoUnsubscribe();
    if (settingsUnsubscribe) settingsUnsubscribe();
    if (bannerUnsubscribe) bannerUnsubscribe();
  }
});

setupAdminLogin();
setupProductForm();
setupPromoForm(); 
setupSettingsForm(); 
setupBannerForm();
renderProductOptions();
async function toggleUserBan(userId, email, shouldBan) {
  const actionText = shouldBan ? "BAN" : "UNBAN";
  const confirmed = await showCustomConfirm(`Are you sure you want to ${actionText} user '${email}'?`);
  
  if (!confirmed) return;

  const userRef = doc(db, "users", userId);
  try {
    await updateDoc(userRef, { 
      isBanned: shouldBan,
      bannedAt: shouldBan ? serverTimestamp() : null
    });
    await showCustomAlert(`User has been ${shouldBan ? "BANNED 🚫" : "UNBANNED ✅"}.`);
  } catch (err) {
    console.error("Ban action failed: ", err);
    await showCustomAlert("Error: " + err.message);
  }
}