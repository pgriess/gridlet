# Build on top of the AWS Lambda NodeJS base image. There's no particularly good
# reason for this, but it works, so may as well just let it ride.
FROM public.ecr.aws/lambda/nodejs:16

ARG ENPHASE_USERNAME
ARG ENPHASE_PASSWORD

COPY package.json package-lock.json ./
COPY src/ ./
RUN npm ci .
RUN test -n "${ENPHASE_USERNAME}" && echo "${ENPHASE_USERNAME}" >.enphase_username.txt
RUN test -n "${ENPHASE_PASSWORD}" && echo "${ENPHASE_PASSWORD}" >.enphase_password.txt

CMD ["lambda.handler"]
