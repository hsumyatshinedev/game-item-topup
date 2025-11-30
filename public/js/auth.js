import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, 
  updateProfile, onAuthStateChanged, 
  sendPasswordResetEmail, updatePassword 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { 
  getFirestore, doc, setDoc, getDoc, updateDoc, addDoc, collection, onSnapshot,
  query, where, arrayUnion, arrayRemove,
  limit, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

import { auth, db, storage } from './firebase.js';
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";
import { 
  $, showAuth, setAuthMsg, showToast, showProfileModal, setProfileMsg, 
  showPasswordModal, setPasswordMsg, setTopupMsg, showTopupModal, showAuthView,
  formatCurrency, updateBalanceAmount, renderHeaderUser 
} from './ui.js';
import { onUserLogin, onUserLogout } from './app.js';

export let currentUser = null;
let userDocListener = null;

const DAILY_BONUS_AMOUNT = 0.01; 
const DAY_IN_MS = 24 * 60 * 60 * 1000; 

export function initAuthListener() {
  onAuthStateChanged(auth, async (user) => {
    
    if (userDocListener) {
      userDocListener(); 
      userDocListener = null;
    }
  
    if (user) {
      renderHeaderUser({ displayName: user.displayName || user.email.split('@')[0], email: user.email });
      
      const userDocRef = doc(db, "users", user.uid);
      const initialDocSnap = await getDoc(userDocRef);
      if (!initialDocSnap.exists()) {
        console.warn(`User doc not found for ${user.uid}. Creating one...`);
        try {
          const nameVal = user.displayName || user.email.split('@')[0];
          await setDoc(userDocRef, {
            name: nameVal,
            email: user.email,
            balance: 0, 
            totalSpentUSD: 0,
            createdAt: serverTimestamp() 
          });
        } catch (err) {
          console.error("Failed to create user doc. Logging out:", err);
          await signOut(auth); 
          return;
        }
      }

      userDocListener = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          currentUser = { 
            ...user, 
            ...userData 
          };
          
          renderHeaderUser(currentUser);
          onUserLogin(currentUser); 
          
        } else {
          console.error(`User doc for ${user.uid} disappeared.`);
        }
      });
      
    } else {
      currentUser = null;
      onUserLogout();
      renderHeaderUser(null);
    }
  });
}


export async function signup() {
  const emailVal = email.value.trim();
  const passwordVal = password.value.trim();
  const nameVal = displayName.value.trim() || emailVal.split('@')[0];
  
  if (passwordVal.length < 6) {
    return setAuthMsg("Error: Password must be at least 6 characters long.");
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, emailVal, passwordVal);
    await updateProfile(cred.user, { displayName: nameVal });
    
    await setDoc(doc(db, "users", cred.user.uid), {
      name: nameVal,
      email: emailVal,
      balance: 0, 
      totalSpentUSD: 0,
      createdAt: serverTimestamp() 
    });
    
    showToast("Account created successfully!", "success");
    showAuth(false); 
  } catch (err) {
    setAuthMsg("Error: " + err.message);
  }
}

export async function signin() {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.value.trim(), password.value.trim());
    showAuth(false);
  } catch (err) {
    setAuthMsg("Login failed: " + err.message);
  }
}

export async function logout() {
  await signOut(auth);
}

export async function sendPasswordReset() {
  const emailVal = $('email').value.trim();
  if (!emailVal) {
    setAuthMsg('Please enter your email address.');
    return;
  }
  
  const btn = $('resetPasswordBtn');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  
  try {
    await sendPasswordResetEmail(auth, emailVal);
    setAuthMsg(''); 
    showToast('Password reset link sent to your email!', 'success');
    showAuthView('login'); 
  } catch (err) {
    console.error('Password reset error:', err);
    setAuthMsg(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Reset Link';
  }
}


export async function saveProfile() {
  const newName = $('profileName').value.trim();
  const newAvatar = $('selectedAvatarUrl').value;
  if (!newName) {
    return setProfileMsg('Please enter a name.');
  }
  if (!currentUser) {
    return setProfileMsg('You are not signed in.');
  }
  
  const btn = $('profileSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  
  try {
    await updateProfile(auth.currentUser, {
      displayName: newName,
      photoURL: newAvatar || auth.currentUser.photoURL
    });
    
    const userDocRef = doc(db, "users", currentUser.uid);
    await updateDoc(userDocRef, {
      name: newName,
      photoURL: newAvatar || currentUser.photoURL
    });
    
    showToast('Profile updated successfully', 'success');
    showProfileModal(false);
  } catch (err) {
    console.error("Profile update failed:", err);
    setProfileMsg('Error updating profile: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

export async function savePassword() {
  const pw = $('newPassword').value;
  if (!pw || pw.length < 6) {
    return setPasswordMsg('Password must be at least 6 characters.');
  }
  
  if (!currentUser) {
    return setPasswordMsg('Not signed in.');
  }
  
  const btn = $('passwordSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  
  try {
    await updatePassword(auth.currentUser, pw);
    showToast('Password updated successfully!', 'success');
    showPasswordModal(false);
  } catch (err) {
    console.error("Password update error:", err);
    if (err.code === 'auth/requires-recent-login') {
      setPasswordMsg('This is a sensitive action. Please log out and log back in, then try again.');
    } else {
      setPasswordMsg(err.message);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save New Password';
  }
}


export async function submitTopupRequest(selectedTopupAmount, selectedTopupMethod) {
  const slipFile = $('slipUpload').files[0];
  if (!slipFile) return setTopupMsg("Please upload your slip image.", 3);
  if (!auth.currentUser) return setTopupMsg("Please sign in again.", 3);
  if (slipFile.size > 5 * 1024 * 1024) { 
    return setTopupMsg("File is too large. Max 5MB.", 3);
  }

  const submitBtn = $('topupSubmitRequestBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = "Uploading Slip..."; 

  try {
    const userId = auth.currentUser.uid;
    const timestamp = Date.now();
    const fileName = `slips/${userId}/${timestamp}-${slipFile.name}`;
    const storageRef = ref(storage, fileName); 

    const uploadResult = await uploadBytes(storageRef, slipFile);
    const downloadURL = await getDownloadURL(uploadResult.ref);
    
    submitBtn.textContent = "Submitting Request..."; 

    const pendingTransaction = {
      type: 'topup',
      item: `${selectedTopupMethod} (Pending)`,
      amount: selectedTopupAmount, 
      date: new Date().toISOString()
    };
    const transactionsRef = collection(db, "users", userId, "transactions");
    const newTxDocRef = await addDoc(transactionsRef, pendingTransaction);



    await addDoc(collection(db, "topupRequests"), {
      userId: userId,
      email: auth.currentUser.email,
      amount: selectedTopupAmount, 
      method: selectedTopupMethod,
      slipImageUrl: downloadURL,
      slipStoragePath: fileName, 
      status: "pending",
      createdAt: serverTimestamp(),
      pendingTxId: newTxDocRef.id 

    });

    showToast("Top-up request submitted successfully!", "success");
    showTopupModal(false);

  } catch (err) {
    console.error("Top-up Error:", err);
    setTopupMsg("Error submitting request: " + err.message, 3);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Request";
  }
}

export async function claimDailyBonus(currentCurrency, EXCHANGE_RATES) {
  if (!currentUser) {
    return showToast("Please sign in to claim your bonus", "error");
  }
  
  const btn = $('claimBonusBtn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Checking...';
  
  const isEligible = checkBonusEligibility(currentUser.lastClaimedDate);
  
  if (isEligible) {
    try {
      btn.querySelector('span').textContent = 'Claiming...';
      const userDocRef = doc(db, "users", currentUser.uid);
      
      const newBalance = parseFloat((currentUser.balance + DAILY_BONUS_AMOUNT).toFixed(2));
      const newClaimDate = new Date().toISOString();
      
      const bonusTx = {
        id: 'txb_' + Date.now(), 
        type: 'bonus',
        item: 'Daily Login Bonus',
        amount: DAILY_BONUS_AMOUNT, 
        date: newClaimDate
      };
      
      await updateDoc(userDocRef, {
        balance: newBalance,
        lastClaimedDate: newClaimDate
      });
      const transactionsRef = collection(db, "users", currentUser.uid, "transactions");
      await addDoc(transactionsRef, bonusTx);     
      const successMsg = `Daily Bonus +${formatCurrency(DAILY_BONUS_AMOUNT, currentCurrency, EXCHANGE_RATES)} ရရှိပါသည်!`;
      showToast(successMsg, 'success');
      
      btn.querySelector('span').textContent = 'Claimed for Today!';
      
    } catch (err) {
      console.error("Error claiming bonus:", err);
      showToast("Error claiming bonus: " + err.message, "error");
      btn.disabled = false; 
      btn.querySelector('span').textContent = '🎁 Claim Daily Bonus';
    }
    
  } else {
    showToast("You've already claimed your bonus for today.", "pending");
    btn.querySelector('span').textContent = 'Claimed for Today!';
  }
}

function checkBonusEligibility(lastClaimed) {
  if (!lastClaimed) {
    return true; 
  }
  
  const now = new Date();
  const lastClaimTime = new Date(lastClaimed);
  const timeDiff = now.getTime() - lastClaimTime.getTime();
  
  return timeDiff > DAY_IN_MS; 
}

export function renderDailyBonusButton() {
  const container = $('dailyBonusContainer');
  if (!container) return;
  
  const btn = $('claimBonusBtn');
  const icon = '🎁'; 
  
  if (currentUser) {
    container.style.display = 'block';
    const isEligible = checkBonusEligibility(currentUser.lastClaimedDate);
    
    if (isEligible) {
      btn.disabled = false;
      btn.querySelector('span').textContent = `${icon} Claim Daily Bonus`;
    } else {
      btn.disabled = true;
      btn.querySelector('span').textContent = 'Claimed for Today!';
    }
    
  } else {
    container.style.display = 'none'; 
  }
}

export function attachAuthEvents() {
  $('closeAuth').addEventListener('click', ()=> showAuth(false, true));
  $('signupBtn').addEventListener('click', signup);
  $('signinBtn').addEventListener('click', signin);
  $('resetPasswordBtn').addEventListener('click', sendPasswordReset); 

  $('toggleToSignup').addEventListener('click', (e) => {
    e.preventDefault();
    showAuthView('signup');
  });
  $('toggleToSignin').addEventListener('click', (e) => {
    e.preventDefault();
    showAuthView('login');
  });
  $('forgotPasswordLink').addEventListener('click', (e) => {
    e.preventDefault();
    showAuthView('forgot');
  });
}