import firebase_admin
from firebase_admin import firestore
from firebase_admin import auth
from firebase_functions import https_fn
import datetime
import time
firebase_admin.initialize_app()

@https_fn.on_call(region="asia-southeast1")
def processPurchase(req: https_fn.Request) -> https_fn.Response:
    db = firestore.client()

    try:
        if req.auth is None:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                message="Please sign in to make a purchase."
            )
        uid = req.auth.uid
        data = req.data
        
        product_id = data.get("productId")    
        product_sku = data.get("productSku")    
        game_user_id = data.get("gameUserId")   
        game_server_id = data.get("gameServerId") 

        if not product_id or not product_sku or not game_user_id:
            return {"success": False, "error": "Missing required data (SKU or UserID)."}

        user_ref = db.collection("users").document(uid)
        product_ref = db.collection("products").document(product_id)
        
        user_doc = user_ref.get()
        product_doc = product_ref.get()

        if not user_doc.exists:
            return {"success": False, "error": "User not found."}
        if not product_doc.exists:
            return {"success": False, "error": "Product not found."}

        user_data = user_doc.to_dict()
        product_data = product_doc.to_dict()
        
        purchased_option = None
        for opt in product_data.get("options", []):
            if opt.get("sku") == product_sku:
                purchased_option = opt
                break

        if purchased_option is None:
            return {"success": False, "error": "Item option not found (SKU mismatch)."}

        price_to_deduct = purchased_option.get("price", {}).get("usd", 0)

        if price_to_deduct <= 0:
             return {"success": False, "error": "Price for this item is not set."}
        user_balance = user_data.get("balance", 0)
        if user_balance < price_to_deduct:
            return {"success": False, "error": "Insufficient balance. Please top-up your wallet."}

        print(f"PYTHON MOCK PURCHASE: User {uid} is buying {product_sku} for ${price_to_deduct}")
        
        fake_api_result = {"status": "success"}

        if fake_api_result.get("status") == "success":
            new_balance = round(user_balance - price_to_deduct, 2)
            now_datetime = datetime.datetime.now(datetime.timezone.utc)
            unique_id = f"tx_py_{int(time.time() * 1000)}"

            tx = {
             "id": unique_id, 
             "type": "purchase",
             "item": f"{product_data.get('name', 'N/A')} ({purchased_option.get('name', 'N/A')})",
             "amount": -price_to_deduct,
             "date": now_datetime.isoformat(), 
             "details": f"ID: {game_user_id} / Server: {game_server_id or 'N/A'}",
            }

            user_ref.update({
                "balance": new_balance
            })
            transactions_ref = user_ref.collection("transactions")
            transactions_ref.add(tx)


            return {"success": True}

        else:
            api_error = fake_api_result.get("message", "Invalid User ID or details")
            return {"success": False, "error": f"Purchase failed: {api_error}"}

    except Exception as e:
        print(f"Backend Error: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"An internal error occurred: {e}"
        )
@https_fn.on_call(region="asia-southeast1")
def setAdminClaim(req: https_fn.CallableRequest) -> https_fn.Response:

    SUPER_ADMIN_EMAIL = "admin@wphyoe3151.com"  

    if req.auth is None or req.auth.token.get('email') != SUPER_ADMIN_EMAIL:
        print(f"Permission denied. Caller email is: {req.auth.token.get('email')}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Error: You do not have permission to run this function."
        )

    target_email = req.data.get("email")
    if not target_email:
        return {"success": False, "error": "Missing 'email' in request data."}

    print(f"Attempting to set admin claim for: {target_email}")

    try:
        user = auth.get_user_by_email(target_email)
        auth.set_custom_user_claims(user.uid, {'admin': True})

        print(f"Successfully set admin claim for {target_email} (UID: {user.uid})")
        return {"success": True, "message": f"Successfully set admin claim for {target_email}"}

    except Exception as e:
        print(f"Error setting claim: {str(e)}")
        return {"success": False, "error": f"An error occurred: {str(e)}"}