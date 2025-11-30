# 🎮 Game Item Topup System (Backend)

![Python](https://img.shields.io/badge/Python-3.10+-blue?style=for-the-badge&logo=python&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Cloud_Functions-orange?style=for-the-badge&logo=firebase&logoColor=white)
![Status](https://img.shields.io/badge/Status-Active-success?style=for-the-badge)

A robust and secure serverless backend system designed to handle in-game item purchases, wallet management, and admin privileges. Built using **Python** on **Firebase Cloud Functions (2nd Gen)**.

---

## 🚀 Key Features

### 1. Secure Purchase Processing (`processPurchase`)
* **Transaction PIN Verification:** Validates user transactions using **SHA-256** hashed PINs for enhanced security.
* **Balance Check:** Automatically verifies if the user has sufficient funds before processing.
* **SKU Validation:** Ensures the requested item exists and matches the correct price in the database.
* **Transaction Logging:** Records every successful purchase in the `transactions` sub-collection with a unique ID (`tx_py_...`).
* **Mock Game Server Integration:** Simulates API calls to game servers to provision items.

### 2. Admin Management (`setAdminClaim`)
* **Role-Based Access Control (RBAC):** Allows the Super Admin to grant "Admin" privileges to other users via Firebase Custom Claims.
* **Environment Security:** The Super Admin email is protected using **Environment Variables**, ensuring no hardcoded credentials exist in the source code.

---

## 🛠️ Technology Stack

* **Backend Framework:** Firebase Cloud Functions (Python v2)
* **Database:** Cloud Firestore (NoSQL)
* **Authentication:** Firebase Auth
* **Security:** SHA-256 Hashing, Environment Variables (.env)

---

## 📂 Project Structure

```bash
game-item-topup/
├── functions/              # Cloud Functions Source Code
│   ├── main.py             # Entry point for all backend logic
│   ├── requirements.txt    # Python dependencies
│   └── .env                # Environment variables (Not uploaded to Git)
├── .gitignore              # Git ignore rules
├── firebase.json           # Firebase configuration
└── README.md               # Project Documentation

⚙️ Setup & Installation
Follow these steps to run the project locally or deploy it.

Prerequisites
Python 3.10 or higher

Node.js & Firebase CLI (npm install -g firebase-tools)

1. Clone the Repository
Bash

git clone [https://github.com/hsumyatshinedev/game-item-topup.git](https://github.com/hsumyatshinedev/game-item-topup.git)
cd game-item-topup
2. Setup Virtual Environment
Bash

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
3. Install Dependencies
Bash

pip install -r functions/requirements.txt
4. Configure Environment Variables
Create a .env file inside the functions/ directory to secure the admin email.

Code snippet

# functions/.env
SUPER_ADMIN_EMAIL="admin@yourdomain.com"
5. Deploy to Firebase
Bash

firebase deploy --only functions
🔐 Security Best Practices Implemented
No Hardcoded Secrets: API keys and Admin Emails are stored in .env.

Input Validation: All incoming data (PIN, Product ID, User ID) is strictly validated before processing.

Atomic Operations: Balance deduction and transaction logging happen in a structured flow to prevent data inconsistency.

📝 License
This project is created for educational and portfolio purposes.
