#!/bin/bash

echo "============================================"
echo "   Nomad Connect - Setup & Install Script"
echo "============================================"
echo ""

# -----------------------------------------------
# API KEYS CONFIGURATION
# -----------------------------------------------
# Replace the placeholder values below with your
# actual API keys, then run this script.
# -----------------------------------------------

# --- Supabase (Required) ---
# Get these from: https://supabase.com → Your Project → Settings → API
export EXPO_PUBLIC_SUPABASE_URL="your-supabase-url-here"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key-here"
export SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key-here"
export SUPABASE_DATABASE_URL="your-supabase-database-url-here"

# --- Groq AI (Required for AI features) ---
# Get this from: https://console.groq.com → API Keys
export GROQ_API_KEY="your-groq-api-key-here"

# --- EmailJS (Required for email features) ---
# Get these from: https://www.emailjs.com → Account → API Keys
export EMAILJS_PUBLIC_KEY="your-emailjs-public-key-here"
export EMAILJS_PRIVATE_KEY="your-emailjs-private-key-here"
export EMAILJS_SERVICE_ID="your-emailjs-service-id-here"
export EMAILJS_TEMPLATE_ID="your-emailjs-template-id-here"

# --- Session Secret (Required) ---
# Any random string for securing sessions
export SESSION_SECRET="your-session-secret-here"

# -----------------------------------------------
# INSTALL DEPENDENCIES
# -----------------------------------------------

echo "Installing Node.js dependencies..."
npm install

if [ $? -eq 0 ]; then
  echo ""
  echo "Dependencies installed successfully!"
else
  echo ""
  echo "ERROR: Failed to install dependencies."
  exit 1
fi

echo ""
echo "============================================"
echo "   Setup Complete!"
echo "============================================"
echo ""
echo "IMPORTANT: Make sure you have set your API"
echo "keys above before running the app."
echo ""
echo "To start the app:"
echo "  Backend:  npm run server:dev"
echo "  Frontend: npm run expo:dev"
echo ""
