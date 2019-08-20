#!/usr/bin/env bash

#
# Copyright © 2019. TIBCO Software Inc.
# This file is subject to the license terms contained
# in the license file that is distributed with this file.
#

#Review and set values for these variables

FUNCTION_NAME="lmi_aws_cw_win";
EXECUTION_ROLE_ARN="arn:aws:iam::";
ULDP_HOST=""
ULDP_COLLECTOR_DOMAIN="LMI_AWS_CW_WIN"

# Nothing to change below this point

FILE=./uldp.js
if [ ! -f "$FILE" ]; then
    echo "$FILE does not exist ! Get it from lmi-supplementals"
    exit 1
fi

COMMAND=npm
if ! [ -x "$(command -v $COMMAND)" ]; then
  echo 'Error: $COMMAND is not installed.' >&2
  exit 1
fi

COMMAND=aws
if ! [ -x "$(command -v $COMMAND)" ]; then
  echo 'Error: $COMMAND CLI is not installed.' >&2
  exit 1
fi

rm -rf node_modules
npm install --silent

COMMAND=zip
if ! [ -x "$(command -v $COMMAND)" ]; then
  echo 'Error: $COMMAND is not installed.' >&2
  exit 1
fi

zip -r -q lmi_aws_cw_win.zip index.js uldp.js node_modules

aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://lmi_aws_cw_win.zip \
    --handler index.handler \
    --runtime nodejs10.x \
    --role $EXECUTION_ROLE_ARN \
    --timeout 30 \
    --environment "Variables={ULDP_HOST=$ULDP_HOST,ULDP_COLLECTOR_DOMAIN=$ULDP_COLLECTOR_DOMAIN}"
