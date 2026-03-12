# 🎵 Request+  
*A modern Twitch song request overlay and Spotify integration app for streamers.*

![Request+ Banner](https://requestplus.xyz/assets/bannerb.png)

---

> [!IMPORTANT]
> If you use Request+, you hereby agree to the [Terms of Service](https://requestplus.xyz/terms-of-service)



## 🧠 Overview  
**Request+** is a free and open-source tool designed for Twitch streamers who want seamless, real-time song requests integrated directly with Spotify, YouTube Music, and Apple Music.  
Built with **React** and **Electron**, Request+ provides a smooth desktop experience — while **Spicetify**, **Pear**, and **Cider** handle communication for playback and track control.

It’s simple, free, and streamer-focused. No subscriptions. No ads. Just you, your chat, and your music.

---

## ⚙️ Features  
- 🎧 **Spotify Integration** — Uses Spicetify for track control and metadata.  
- 💬 **Twitch Chat Requests** — Viewers can request songs live using chat commands.  
-  **Stream Overlay** — Add a visual overlay to OBS or Streamlabs to display “Now Playing.”  
- 🔐 **Twitch OAuth Login** — Secure login via Twitch API.  
- 🗂 **Request Queue Management** — Skip, reorder, and manage incoming requests.  
-  **Lightweight UI** — React + Electron for fast, minimal system resource usage.  
- 🆓 **Completely Free** — No premium or paywalled features.  
- ☁️ **Data Privacy** — Only Twitch and kick usernames and tokens are stored; You can find more about our practices in our [privacy policy](https://requestplus.xyz/privacy-policy).

---

## 🛠️ Tech Stack  
| Component | Technology |
|------------|-------------|
| Framework | **React** |
| Desktop Runtime | **Electron** |
| Spotify Integration | **Spicetify API** |
| Twitch Integration | **Twitch OAuth / API** |
| Overlay | Web overlay (Browser Source for OBS/Streamlabs) |
| Backend | Node.js (if applicable) |

---

## 🚀 Installation  

### 📦 Download  
You can find the latest release on the [**Releases Page**](https://github.com/darkwolfie-youtube/requestplus/releases).

Download the version for your platform:  
- **Windows (.exe | Microsoft Store)**  
- **macOS (.dmg)**
- **Linux (.deb)**

### 🧩 Requirements  
- **Spotify desktop app** (latest version)  
- **Spicetify CLI** installed and configured  
- Internet connection (for Twitch)

### Soft Dependants
- Twitch is only a soft dependant, this is for song requests.
  - Song requests are disabled by default

---

## 🧰 Development Setup  

```bash
# Clone the repo
git clone https://github.com/DarkWolfie-YouTube/requestplus.git
cd requestplus

# Install dependencies
npm install

# Run the development environment
npm run start

# Build for production
npm run make
```
---

Make sure **Spicetify** is installed and configured correctly on your system:

> 📘 [https://spicetify.app/docs/getting-started](https://spicetify.app/docs/getting-started)

---

## 🎮 Usage

You can find a guide to install everything you need on [https://requestplus.xyz/docs](https://requestplus.xyz/docs)


---

## 🔒 Terms of Use & Privacy

By logging in with Twitch, users agree to the Request+ Terms of Use.

* Request+ is **free** and has **no premium features.**
* **Donations** are voluntary and **non-refundable.**
* Request+ **does not store** Spotify data or playback history.
* Only **Twitch usernames and access tokens** are temporarily stored.
* Service updates or changes will be announced on the official Discord or website.

---

## 💡 FAQ

**Q:** Is Request+ affiliated with Twitch or Spotify?
**A:** No, Request+ is an independent project and is not endorsed or affiliated with Twitch, Spotify, or Spicetify.

**Q:** Can I customize the overlay?
**A:** Yes! You can edit its CSS or use a template theme to theme it however you like.

**Q:** What happens if Spotify or Twitch APIs go down?
**A:** Request+ won’t be able to fetch or play new songs until the APIs recover.

**Q:** Is my data safe?
**A:** Yes — only basic authentication tokens are stored, and they’re securely managed.

---

## 🧩 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch

   ```bash
   git checkout -b feature/new-feature
   ```
3. Commit your changes

   ```bash
   git commit -m "Add new feature"
   ```
4. Push to your fork and open a Pull Request

---

## 📜 License

```
GNU GPLv3
Copyright (c) 2025 Quil DayTrack (https://darkwolfie.com)
```

---

## 🌐 Links

* 🌎 Website: [https://requestplus.xyz](https://requestplus.xyz)
* 💬 Discord: [https://discord.gg/gXDFGAhvNY](https://discord.gg/gXDFGAhvNY)




