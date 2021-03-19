# Collecting Windows logs for AWS EC2 instances using CloudWatch agent

This repository contains the elements to collect Microsoft Windows event logs from Amazon Webs Services (AWS) EC2 instances and forward them to an instance of TIBCO LogLogic® Log Management Intelligence (LMI), through the use of Amazon Cloud Watch and AWS Lambda functions.

## Requirements

* LMI >= 6.2.0
* NodeJS 10.x
Put the uldp.js file from the supplemental disk into the directory containing this file.
run npm install

## How to configure the AWS CloudWatch Agent

### Preliminary step (to be done once)

To create the IAM role necessary for each server to run CloudWatch agent

Sign in to the AWS Management Console and open the IAM console
In the navigation pane on the left, choose Roles, Create role. 
For Choose the service that will use this role, choose EC2 Allows EC2 instances to call AWS services on your behalf. Choose Next: Permissions. 
In the list of policies, select the check box next to CloudWatchAgentServerPolicy. Use the search box to find the policy, if necessary. 
Choose Next: Review. 
Confirm that CloudWatchAgentServerPolicy appear next to Policies. In Role name, type a name for the role, such as CloudWatchAgentServerRole. Optionally give it a description, and choose Create role. 
The role is now created.

### Collecting Windows logs from EC2 instance

#### Attach IAM role to EC2 instance

In the console, attach the role to the EC2 instance from which to collect logs using CloudWatchAgent.

#### Download CloudWatch agent

https://s3.amazonaws.com/amazoncloudwatch-agent/windows/amd64/latest/AmazonCloudWatchAgent.zip

#### Install CloudWatch agent

On a server running Windows Server, open PowerShell, change to the directory containing the unzipped package, and use the install.ps1 script to install it, after unzipping the content if necessary.

#### Configure CloudWatch agent

##### Option 1: Configuration using Wizard

```
cd "C:\Program Files\Amazon\AmazonCloudWatchAgent"

Unblock-File *.ps1

Unblock-File *.exe

amazon-cloudwatch-agent-config-wizard.exe
```

You choose the logGroup to use for each journal, that can be the same for all of them, it can also be shared with other cloudWatchAgent, however the logGroup should contain ONLY Windows events, and nothing else.

Store in SSM: no

##### Option #2: Manual Configuration

Create a config.json file manually, reference manual is here:
https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Agent-Configuration-File-Details.html

If you want to have the Windows EC2 instance IP address transmitted to LMI, you have to put it in the log_stream_name parameter.

Sample file (config.json), this one collects ONLY windows events from Security, System, Application channels, and sent them all into a 'WindowsEvents' log group, with host_ip_instandId log stream name.

#### Start the CloudWatch agent

```
./amazon-cloudwatch-agent-ctl.ps1 -a fetch-config -m ec2 -c “file:C:\Program Files\Amazon\AmazonCloudWatchAgent\config.json” -s
```

## How to create the lambda function

#### Option #1: Using the AWS console

##### Create the ZIP file

```
zip -r -q lmi_aws_cw_win.zip index.js uldp.js node_modules
```

##### Create the lambda function using the following specifications
Runtime: NodeJS 10.x

Handler: index.handler

Environment variables:

ULDP_HOST <value of the hostname/IP of LMI>

ULDP_COLLECTOR_DOMAIN <give a name to easily identify source in LMI>

Role : lambda basic execution is enough

Memory: 128MB

Timeout: 30s

#### Option #2: Using the AWS CLI

You can use the deploy.sh script, first fill in the variables in the first section, then run the script.

#### Send CloudWatch Log Group to Lambda Function (CloudWatch page)

Select log group, in the console, then Actions/Streaming to Lambda

Select the lambda function to use, then next

LogFormat: other, then next

Start streaming

# TLS support

To enable secure TLS with the Lambda functions, in addition to the regular settings, you need to put a file named tls_options.json in the Lambda function directory or ZIP file.
This file should have the following content:
```
{
"ca": "<base 64 encoding of the CA certificate PEM file>",
"cert": "<base 64 encoding of the client certificate PEM file>",
"key": "<base 64 encoding of the client certificate key PEM file>",
"passphrase": "<passphrase for opening the key file>",
"noCheckServerIdentity": <true or false>
}
```
The presence of a well formatted file automatically enables TLS mode.
