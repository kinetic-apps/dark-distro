General info

We maintain an sms-activate compatible API.
You may have 20 active rentals at a time. Once you get the code or cancel the rental, you can rent a new number. We encourage you to reserve a number just before you need to use it, so that you don't block the number for different users for too long. If you need a higher limit, please contact support.
In order to make API calls, you need to provide your API token as api_key in the URL.
You can get your API key on this page.
Getting user balance
curl "https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=getBalance"
# Response example (balance is in dollars): ACCESS_BALANCE:50.30
# Not authorized: BAD_KEY
Renting a number

You'll need to have sufficient balance and know the shortcode of the service. You can get the shortcode from the Services page.
You can also specify max_price - the maximum price you're willing to pay for the number. The request will fail with MAX_PRICE_EXCEEDED if the current price of the service is higher than max_price. max_price is to be specified in dollars, e.g. max_price=0.50 means 50 cents. To ensure compatibility with sms-activate, maxPrice can be used as an alias of max_price. Max price is inclusive, i.e. if you set it to 0.50, and the price is exactly 0.50, the request will succeed.
For example: the current price of service X is $0.50. We see a surge in demand where numbers get sold out instantly and we increase the price to $0.60. If you have set max_price to $0.50, you'll get an error on the next API call. However if we see the demand at $0.50 is low, we will decrease the price to $0.40. In this case your API calls will work and you will only pay $0.40 for the number.
We recommend that you include max_price with every request. This could help you prevent unexpected expenses in case we raise the price.
Each successful rental also has X-Price header set to the effective price of the rented number.
You can specify area codes in the `areas` query string parameter. Such rentals are subject to a 20% price increase. For example, areas=212,718 will only rent numbers with area codes 212 or 718.
You can specify carrier in the `carriers` query string parameter. You need to use "tmo" for T-Mobile, "vz" for Verizon, and "att" for AT&T. Such rentals are also subject to a 20% price increase. For example, carriers=tmo,vz will only rent numbers by T-Mobile or Verizon.
You can specify phone number in the `number` query string parameter. Such rentals are also subject to a 20% price increase. For example, number=11112223344 will attempt to rent the service with the number +11112223344 if the number hasn't yet been used for that service by another user.
curl "https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=getNumber&service=ds&max_price=5.5"
# Got the number: ACCESS_NUMBER:999999:13476711222
# Max price exceeded: MAX_PRICE_EXCEEDED
# No numbers left: NO_NUMBERS
# Need to finish some rentals before renting more: TOO_MANY_ACTIVE_RENTALS
# Not enough balance left: NO_MONEY
# Example with area codes
curl "https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=getNumber&service=ds&max_price=5.5&areas=201,520"
# Example with carrier and area codes
curl "https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=getNumber&service=ds&max_price=5.5&carriers=tmo&areas=201,520"
Getting the code

You'll need the ID that you got from the rent number response. Please poll every 3 seconds or more.
You can add &text=1 to query string to get full message text to X-Text response header.
# GET https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=getStatus&id=$ID
curl "https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=getStatus&id=308"
# Got code: STATUS_OK:12345
# Wrong ID: NO_ACTIVATION
# Waiting for SMS: STATUS_WAIT_CODE
# Rental cancelled: STATUS_CANCEL
Marking rental as done

Some services support getting multiple codes within your rental timeframe. Once you're done with the number and don't need to receive any more SMS to it, we suggest that you mark it as "done". This helps our service and makes sure you don't run out of the limit of numbers waiting for SMS at the same time.
# GET https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=setStatus&id=$ID&status=6
curl "https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=setStatus&id=308&status=6"
# Success: ACCESS_ACTIVATION
# Failure (rental missing): NO_ACTIVATION
Additional rentals

You may want to get an additional message after you've already received one previously on the same number. This is possible in case we have the number in our system. You can check the availability of the number on the rentals history page.
In case the number is currently active, it can be rented again immediately. Otherwise, it needs to be activated first. This means you will need to wait before the number can receive more messages. Switching from one number to another takes about 60 seconds, but in case there are currently active rentals on the number that will need to go offline to make room for the one you requested - you'll need to wait for the active rentals to finish.
If you need to wait, you'll be given the maximum UNIX timestamp at which the number will be ready. In case some other users complete their rentals faster, readiness may shift to an earlier time. You should check status every 15 seconds. You can send the code as soon as it turns to "STATUS_WAITING".
As activations disrupt the normal work of our system, in case you request one, but don't receive any message a penalty of $0.20 may be garnished from your balance.
# GET https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=getExtraActivation&activationId=$PREVIOUS_ACTIVATION_ID
curl "https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=getExtraActivation&activationId=10618"
# Success: ACCESS_CANCEL
# Failure (rental missing or already got the code): ACCESS_READY
Long-term rentals / LTR

You can keep the number by adding &ltr=1 to the getNumber request. Each service has a daily price to keep using the number, which is displayed at the Services page. When you request a long-term rental, you receive a number in the same way as you would if &ltr was not specified. If you cancel the rental, you receive the money back. If you receive a message to said number, it will remain in our system for the next 24 hours.
You will be able to activate the number to receive more messages using the wakeup API. Additional messages are free, but activating and NOT receiving a message may incur a penalty. After 24 hours, if the number is set to auto-renew, the system tries to take the daily fee from your balance. If it succeeds, the number remains in our system for 24 hours more. Otherwise, it's removed.
You can control whether you want to enable auto-renew or not using the &auto_renew=1 parameter.
curl "https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=getNumber&service=ds&ltr=1&auto_renew=1"
# Got the number: ACCESS_NUMBER:999999:13476711222
Changing auto renew value

# GET https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=setAutoRenew&id=$ID&value=true/false
curl "https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=setAutoRenew&id=123&value=false"
# Changed the value: OK
Cancelling a rental

You can cancel a rental and receive the locked money back to your main balance. Please refrain from looping through numbers without using them since it may get your account banned.
# GET https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=setStatus&id=$ID&status=8
curl "https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=setStatus&id=308&status=8"
# Success: ACCESS_CANCEL
# Failure (rental missing or already got the code): ACCESS_READY
Getting a list of services with prices

There are 2 ways to get the list of services along with info about remaining numbers, prices, and whether the service can receive more than one sms. If there are more than 100 numbers remaining, you are not shown the exact amount. For example if there are 55 number remaining, you will see "55" in the response. If there are 155 numbers remaining, you will see "100". 187 is the code for USA in sms-activate API.
Getting an object that goes: service => country => data:
curl "https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=getPricesVerification"
Getting an object that goes: country => service => data:
curl "https://daisysms.com/stubs/handler_api.php?api_key=$APIKEY&action=getPrices"
Webhooks

You can set a webhook URL on the profile page. If you do so, incoming SMS will be forwarded in a POST request to that address. If your server doesn't respond with a 2xx status code, the attempt will be retried 15 seconds later for a maximum of 8 times. The timeout for the request is 3 seconds.
The format of the message is as follows:
{
    "activationId": 123,
    "messageId": 999,
    "service": "go",
    "text": "Your sms text",
    "code": "Your sms code",
    "country": 0,
    "receivedAt": "2022-06-01 17:30:57"
}