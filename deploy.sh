#!/bin/bash

echo "Starting Node.js Backend Deployment..."

# Update system
sudo apt update

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Git
sudo apt install git -y

# Clone the project
git clone https://github.com/madhucm17/ReactBackend.git
cd ReactBackend

# Install dependencies
npm install

# Create uploads directory
mkdir -p uploads

# Test the application
echo "Testing the application..."
node server.js &
sleep 5
kill %1

# Start with PM2
pm2 delete ReactBackend || true
pm2 start server.js --name ReactBackend

# Enable PM2 to restart on reboot
pm2 startup
pm2 save

# Open firewall port
sudo ufw allow 8081

echo "Backend deployment completed!"
echo "Backend is running on: http://13.126.226.179:8081"
echo "PM2 status:"
pm2 status
