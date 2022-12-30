# NOTES
#
# - Build as follows
#
#       docker image build \
#           --build-arg ENPHASE_USERNAME=pgriess@gmail.com \
#           --build-arg=ENPHASE_PASSWORD=XXXXXX \
#           .

# Use Node 16 to match .nvmrc
FROM public.ecr.aws/lambda/nodejs:16

ARG ENPHASE_USERNAME
ARG ENPHASE_PASSWORD

COPY package.json package-lock.json ./
COPY src/ ./src/
RUN npm ci .
RUN npm ln .
RUN test -n "${ENPHASE_USERNAME}" && echo "${ENPHASE_USERNAME}" >.enphase_username.txt
RUN test -n "${ENPHASE_PASSWORD}" && echo "${ENPHASE_PASSWORD}" >.enphase_password.txt

COPY lambda-entrypoint.sh /
