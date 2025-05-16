# Step 1: Update System Packages

```
sudo apt update
sudo apt upgrade -y
```

# Step 2: Install NodeJS

```
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

```
node -v
npm -v
```

# Step 3: Install PM2

```
sudo npm install -g pm2
```

# Step 4: Add Github SSH:

```
ssh-keygen -t ed25519 -C "your_email@example.com"
```

```
eval "$(ssh-agent -s)"
```

```
ssh-add ~/.ssh/id_ed25519
```

```
cat ~/.ssh/id_ed25519.pub
```

Then:

> Add the SSH Key to GitHub

# Step 5: Run Application with PM2

```
sudo chmod 644 .env
```

Then

```
pm2 start app.js --name "my-app"  # replace app.js with your entry file
```

OR

```
pm2 start app.js --name "my-app" -- start --env .env --port 9000 --host 0.0.0.0  # replace app.js with your entry file
```

# Step 6: PM2 Commands

```
pm2 list              # List all processes
pm2 restart my-app    # Restart your app
pm2 stop my-app       # Stop your app
pm2 delete my-app     # Remove from PM2
pm2 logs              # View logs
pm2 save              # Save current process list
pm2 startup           # Generate startup script
```

# Step 7: To make PM2 start on system boot

```
pm2 startup

# Run the command it gives you (something like:)
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

pm2 save
```

# Step 8: Install and Configure Nginx

```
sudo apt install nginx -y
```

Start Nginix

```
sudo systemctl start nginx
sudo systemctl enable nginx
```

Check Status

```
sudo systemctl status nginx
```

# Step 9: Configure Nginx as Reverse Proxy

```
sudo nano /etc/nginx/sites-available/reverse_proxy.conf
```

```
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name sub.domain.com sub.domain.com;
    return 301 https://$host$request_uri;
}

# HTTPS for sub.domain.com (port 8000)
server {
    listen 443 ssl;
    server_name sub.domain.com;

    # Use the SAME certificate as sub.domain.com
    ssl_certificate /etc/letsencrypt/live/sub.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sub.domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTPS for sub.domain.com (port 9000)
server {
    listen 443 ssl;
    server_name sub.domain.com;

    ssl_certificate /etc/letsencrypt/live/sub.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sub.domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the configuration

```
sudo ln -s /etc/nginx/sites-available/reverse_proxy.conf /etc/nginx/sites-enabled/
```

Get SSL Certificates

```
sudo systemctl stop nginx
sudo apt install certbot
sudo certbot certonly --standalone -d sub.domain.com -d sub.domain.com
sudo systemctl start nginx
```

Obtain SSL Certificates

```
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Get certificates for both domains
sudo certbot --nginx -d domain.com -d sub.domain.com
```

Test and restart Nginx

```
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

allow traffic on port 80

```
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

Test and Reload Nginx

```
sudo nginx -t  # Check for syntax errors
sudo systemctl reload nginx
```

# AI Project: ecosystem.config.js

```
module.exports = {
  apps: [{
    name: "ai",
    cwd: "/home/ubuntu/<project-folder>",  // full path to your project
    script: "/home/ubuntu/llamaenv/bin/python",  // python from your virtualenv
    args: "-m uvicorn <file-name>:app --host 0.0.0.0 --port <port>",
    interpreter: "none",
    autorestart: true,
    env: {
      PYTHONPATH: "/home/ubuntu/<project-folder>",
      // Add other environment variables if needed
    },
    log_file: "logs/<file-name>.log",
    error_file: "logs/<file-name>-error.log",
    out_file: "logs/<file-name>-out.log",
    time: true
  }]
}
```
