FROM node:16.20
#RUN mkdir -p /home/node/app && chown -R node:node /home/node/app
#RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /app
#COPY --chown=node:node package*.json ./
#RUN npm i
COPY . .
RUN  npm i
EXPOSE 3002
CMD ["npm","run", "start"]
