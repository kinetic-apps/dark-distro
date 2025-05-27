PI Description

Retrieve the list of cloud phones.

Request URL

https://openapi.geelark.com/open/v1/phone/list
Request Method

POST
Request Parameters

Pagination Parameters

Parameter Name	Required	Type	Description	Example
page	No	integer	Page number, minimum is 1	1
pageSize	No	integer	Number of records per page, minimum is 1, maximum is 100	10
Query Parameters (Ignored if empty)

Parameter Name	Required	Type	Description	Example
ids	No	array[string]	Cloud phone ID array，The maximum length of the array is 100. If the array is not empty, these two parameters： page pageSize, will not take effect	[“5213214343124321”]
serialName	No	string	Cloud phone name	test
remark	No	string	Cloud phone remark	test
groupName	No	string	Cloud phone group name	test group
tags	No	array[string]	List of cloud phone tag names	See example
Request Example

{
    "page":1,
    "pageSize":10,
    "serialName": "test",
    "remark":"",
    "groupName":"",
    "tags":[
        "tag1",
        "tag2"
    ]
}
Response Data Description

Parameter Name	Type	Description
total	integer	Total number of cloud phones
page	integer	Page number
pageSize	integer	Page size
items	array[Phone]	List of cloud phones
items Cloud Phone Data <Phone>

Parameter Name	Type	Description
id	string	Cloud phone ID
serialName	string	Cloud phone name
serialNo	string	Cloud phone serial number
group	Group	Cloud phone group information
remark	string	Cloud phone remark
status	int	Cloud phone status
0 - Started
1 - Starting
2 - Shut down
tags	array[Tag]	List of cloud phone tags
equipmentInfo	EquipmentInfo	cloud phone equipment info
proxy	Proxy	Proxy info
group Group Information <Group>

Parameter Name	Type	Description
id	string	Group ID
name	string	Group name
remark	string	Group remark
tags Cloud Phone Tags <Tag>

Parameter Name	Type	Description
name	string	Cloud phone tag name
equipmentInfo Cloud phone equipment info <EquipmentInfo>

Parameter Name	Type	Description
countryName	string	country name
phoneNumber	string	phone number
enableSim	int	is Sim enable : 0 unable 1 enable
imei	string	IMEI
osVersion	string	system version
wifiBssid	string	Wi-Fi MAC Address
mac	string	phone Wi-Fi MAC Address
bluetoothMac	string	bluetooth Mac Address
timeZone	string	timezone
deviceBrand	string	brand
deviceModel	string	model
proxy Proxy info <Proxy>

Parameter Name	Type	Description
type	string	Proxy type (socks5, http, https)
server	string	Proxy server
port	int	Proxy port
username	string	Proxy username
password	string	Proxy password
Response Example

{
    "traceId": "123456ABCDEF",
    "code": 0,
    "msg": "success",
    "data": {
        "total": 1,
        "page": 1,
        "pageSize": 10,
        "items": [
            {
                "id": "123456ABCDEF",
                "serialName": "test",
                "serialNo": "1",
                "group": {
                    "id": "123456ABCDEF",
                    "name": "test group",
                    "remark": "group remark"
                },
                "remark": "env remark",
                "status": 0,
                "tags": [
                    {"name": "hi"},
                    {"name": "test"}
                ],
                "equipmentInfo": {
                    "countryName": "Thailand",
                    "phoneNumber": "+66877382166",
                    "enableSim": 1,
                    "imei": "863406055475987",
                    "osVersion": "Android 11.0",
                    "wifiBssid": "1C:1D:67:B1:C1:76",
                    "mac": "9C:A5:C0:5F:C5:AD",
                    "bluetoothMac": "D0:15:4A:5B:7E:AE",
                    "timeZone": "Asia/Bangkok"
                 },
                "proxy": {
                    "type": "socks5",
                    "server": "129.129.129.129",
                    "port": 30000,
                    "username": "user",
                    "password": "pass"
                }
            }
        ]
    }
}
Error Codes

Error codes can be found in the API Documentation.

Error Code	Description
42001	Cloud phone does not exist