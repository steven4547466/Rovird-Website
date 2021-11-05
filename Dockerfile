#load alpine release of node image
FROM node:alpine

#set directory
WORKDIR /usr/app

##get and install dependencies
COPY ./package.json ./
RUN npm install

#copy everything else
COPY ./ ./

#start script on run
CMD ["npm", "start"]