import time
import requests
import os
import hashlib
import uuid
import uiautomator2 as u2
from uiautomator2 import Device


# Configuration
app_id = "YOUR_APP_ID"
api_key = "YOUR_API_KEY"


def generate_headers():
    timestamp = str(int(time.time() * 1000))
    trace_id = str(uuid.uuid4()).replace('-', '')
    nonce = trace_id[:6]
    sign_str = app_id + trace_id + timestamp + nonce + api_key
    sign = hashlib.sha256(sign_str.encode()).hexdigest().upper()
    return {
        "Content-Type": "application/json",
        "appId": app_id,
        "traceId": trace_id,
        "ts": timestamp,
        "nonce": nonce,
        "sign": sign
    }


def get_idle_cloud_phones(page=1, page_size=100):
    url = "https://openapi.geelark.com/open/v1/phone/list"
    headers = generate_headers()
    payload = {"page": page, "pageSize": page_size}

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

        if data.get("code") == 0:
            items = data["data"]["items"]
            idle_phones = [
                {
                    "id": item["id"],
                    "name": item.get("serialName", "Unnamed"),
                    "ip": item.get("proxy", {}).get("server", "N/A"),
                    "port": item.get("proxy", {}).get("port", "N/A"),
                    "status": item["status"]
                }
                for item in items if item.get("status") == 0
            ]
            return idle_phones
        else:
            print(f"[API Error] {data.get('msg')}")
    except Exception as e:
        print(f"[Error] Getting cloud phone list: {e}")

    return []


def enable_adb(device_id):
    url = "https://openapi.geelark.com/open/v1/adb/setStatus"
    headers = generate_headers()
    payload = {"ids": [device_id], "open": True}
    try:
        requests.post(url, headers=headers, json=payload)
        print("[ADB] Enabled")
    except Exception as e:
        print(f"[Error] Enable ADB: {e}")


def get_adb_info(device_id):
    url = "https://openapi.geelark.com/open/v1/adb/getData"
    headers = generate_headers()
    payload = {"ids": [device_id]}
    try:
        response = requests.post(url, headers=headers, json=payload)
        data = response.json()
        if data.get("code") == 0:
            for item in data["data"]["items"]:
                if item["id"] == device_id:
                    return item
    except Exception as e:
        print(f"[Error] ADB info: {e}")
    return None


def connect_device(adb_ip, adb_port, adb_password):
    try:
        os.system(f"adb connect {adb_ip}:{adb_port}")
        os.system(f"adb -s {adb_ip}:{adb_port} shell zxlogin {adb_password}")
        print(f"[ADB] Connected to {adb_ip}:{adb_port}")
    except Exception as e:
        print(f"[ADB] Connect failed: {e}")



def request_5sim_code_and_verify_tiktok(d):
    import requests, time

    headers = {
        "Authorization": "Bearer xxx",
        "Accept": "application/json"
    }

    # Step 1: Get phone number from 5SIM
    while True:
        try:
            print("[5SIM] Requesting phone number...")
            response = requests.get(
                "https://5sim.net/v1/user/buy/activation/usa/virtual40/tiktok?maxPrice=9",
                headers=headers
            )
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "phone" in data:
                    break
                print("[5SIM] No number yet, retrying...")
            else:
                print(f"[5SIM] Status {response.status_code}, retrying...\n{response.text}")
        except Exception as e:
            print(f"[5SIM] Error: {e}")
        time.sleep(5)

    five_sim_id = data["id"]
    five_sim_phone_number = data["phone"].removeprefix("+1")
    print(f"[5SIM] Number: {five_sim_phone_number}, ID: {five_sim_id}")
    time.sleep(3)

    # Step 2: Input phone number and click 'Continue'
    phone_field = d(className="android.widget.EditText", focused=True)
    if phone_field.exists:
        print("[App] Entering phone number...")
        phone_field.set_text(five_sim_phone_number)
        time.sleep(1)
        d.press("enter")
    else:
        print("[App] Phone input field not found.")
        return

    for _ in range(10):
        continue_btn = d(resourceId="com.zhiliaoapp.musically:id/do0", text="Continue")
        if continue_btn.exists:
            continue_btn.click()
            print("[App] Clicked 'Continue'.")
            break
        time.sleep(1)
    else:
        print("[App] 'Continue' button not found.")
        return

    # Step 3: Poll for SMS OTP
    otp_code = None
    while True:
        try:
            print("[5SIM] Polling for SMS...")
            check = requests.get(f"https://5sim.net/v1/user/check/{five_sim_id}", headers=headers)
            sms_data = check.json()
            if sms_data.get("status") == "RECEIVED" and sms_data.get("sms"):
                otp_code = sms_data["sms"][0]["code"]
                print(f"[5SIM] Received OTP: {otp_code}")
                break
            else:
                print("[5SIM] Waiting for SMS...")
        except Exception as e:
            print(f"[5SIM] Polling error: {e}")
        time.sleep(5)

    # Step 4: Input OTP and tap 'Next'
    otp_field = d(className="android.widget.EditText", focused=True)
    if otp_field.exists:
        print("[App] Entering OTP...")
        otp_field.set_text(otp_code)
        time.sleep(1)
        d.press("enter")
        next_btn = d.xpath("//android.widget.Button[@text='Next']")
        if next_btn.exists:
            next_btn.click()
            print("[App] OTP submitted.")
        else:
            print("[App] 'Next' button not found.")
    else:
        print("[App] OTP input field not found.")

    # Step 5: Confirm account creation
    for _ in range(10):
        create_btn = d(resourceId="android:id/button1", text="Create account")
        if create_btn.exists:
            create_btn.click()
            print("[App] Clicked 'Create account'.")
            break
        time.sleep(1)
    else:
        print("[App] 'Create account' button not found.")



def click_use_phone_or_email(d: u2.Device, timeout: int = 30):
    """
    Attempts to find and click the 'Use phone or email' button on the TikTok login screen.
    """
    print("[Step] Waiting for 'Use phone or email' button...")
    for _ in range(timeout):
        xpath_query = "//*[contains(@text, 'Use phone') or contains(@text, 'email')]"
        btn = d.xpath(xpath_query)
        if btn.exists:
            print("[Found] 'Use phone or email' button. Clicking...")
            btn.click()
            time.sleep(2)
            return True
        time.sleep(1)

    print("[Error] 'Use phone or email' button not found within timeout.")
    return False


def click_profile_button(d: u2.Device, timeout: int = 15):

    print("[Step] Waiting for the 'Profile' button...")

    for _ in range(timeout):
        profile_btn = d.xpath('//*[@content-desc="Profile"]')
        if profile_btn.exists:
            print("[Found] 'Profile' button. Clicking it...")
            profile_btn.click()
            time.sleep(2)
            return True
        time.sleep(1)

    print("[Error] 'Profile' button not found after waiting.")
    return False


def choose_device(devices):
    print("\nAvailable idle cloud phones:")
    for i, dev in enumerate(devices):
        info = f"[{i + 1}] ID: {dev['id']} | IP: {dev.get('ip', 'N/A')} | Name: {dev.get('name', 'Unnamed')} | Port: {dev.get('port', 'N/A')}"
        print(info)

    while True:
        try:
            choice = int(input(f"\nSelect a device [1-{len(devices)}]: "))
            if 1 <= choice <= len(devices):
                return devices[choice - 1]
        except ValueError:
            pass
        print("Invalid selection, try again.")


def automate_full_flow(d: Device):
    print("[Start] Launching Tiktok app...")
    d.app_start('com.zhiliaoapp.musically')
    time.sleep(3)

    click_profile_button(d)
    time.sleep(3)

    success = click_use_phone_or_email(d)
    if not success:
        print("[Abort] Could not find 'Use phone or email'. Exiting automation.")
        return

    # Continue with next steps (e.g., input phone number, etc.)
    request_5sim_code_and_verify_tiktok(d)



if __name__ == "__main__":
    idle_devices = get_idle_cloud_phones()

    if not idle_devices:
        print("No idle cloud phones available.")
        exit(1)

    device_info = choose_device(idle_devices)
    device_id = device_info["id"]
    enable_adb(device_id)
    time.sleep(5)

    adb_info = get_adb_info(device_id)
    if not adb_info:
        print("Could not get ADB info.")
        exit(1)

    adb_ip = adb_info["ip"]
    adb_port = adb_info["port"]
    adb_pwd = adb_info["pwd"]

    connect_device(adb_ip, adb_port, adb_pwd)
    print("[u2] Connecting to device...")
    d = u2.connect(f"{adb_ip}:{adb_port}")
    print("[u2] Connected. Running full automation flow...")

    automate_full_flow(d)


