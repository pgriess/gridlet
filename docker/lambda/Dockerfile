# Build on top of the AWS Lambda NodeJS base image. There's no particularly good
# reason for this, but it works, so may as well just let it ride.
FROM public.ecr.aws/lambda/nodejs:16

COPY package.json package-lock.json ./
COPY src/ ./
RUN npm ci .

CMD ["./driver/lambda.handler"]
