API Description

A task can be retried up to 5 times.
Tasks created by the client will automatically retry up to 2 times if they fail, while tasks created via the API will not automatically retry.
If the task still fails after automatic retries, this interface can be called to retry the task.
The interface can be called to retry the task when the task is in the following states:

Task Failed
Task Canceled
Request URL

https://openapi.geelark.com/open/v1/task/restart
Request Method

POST
Request Parameters

Parameter Name	Required	Type	Description
ids	Yes	array[string]	Array of task IDs
Request Example

{
    "ids": ["123321", "456654"]
}
Response Data Description

Parameter Name	Type	Description
totalAmount	integer	Total number of tasks processed
successAmount	integer	Number of tasks processed successfully
failAmount	integer	Number of tasks failed to process
failDetails	array[FailDetail]	Details of failed tasks
FailDetail

Parameter Name	Type	Description
id	string	Task ID
code	integer	Error code
msg	string	Error message
Response Examples

All Successful

{
    "traceId": "123456ABCEDF",
    "code": 0,
    "msg": "success",
    "data": {
        "totalAmount": 10,
        "successAmount": 10,
        "failAmount": 0
    }
}
All Failed

{
    "traceId": "123456ABCEDF",
    "code": 40000,
    "msg": "unknown error"
}
or

{
    "traceId": "123456ABCEDF",
    "code": 40009,
    "msg": "process all failure",
    "data": {
        "totalAmount": 1,
        "successAmount": 0,
        "failAmount": 1,
        "failDetails": [
            "id": "123456ABCEDF"
            "code": "48001",
            "msg": "the current task status does not allow the operation"
        ]
    }
}
Partial Success

{
    "traceId": "123456ABCEDF",
    "code": 40006,
    "msg": "partial success",
    "data": {
        "totalAmount": 2,
        "successAmount": 1,
        "failAmount": 1,
        "failDetails": [
            "id": "123456ABCEDF"
            "code": "48001",
            "msg": "the current task status does not allow the operation"
        ]
    }
}
Error Codes

For outer response error codes, please refer to the API Call Documentation.

Single Task Processing Error Codes

Error Code	Description
40005	Environment has been deleted
48000	Task retry limit reached
48001	Task status does not allow retry
48002	Task does not exist
48003	The task resource has expired