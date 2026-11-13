**Subject:** Can you set up a SharePoint site for the Maginhawa app? (about 30 minutes)

Hi Hanz,

I'm building the checklists for the Maginhawa app (opening, closing, temperatures and so on), and I need a SharePoint site for it. I don't have permission to create sites, so could you set it up for me? Below is why I need it and exactly what to do. It should take about 30 minutes.

### Why I need a new site, not a folder

I tried using a folder in Maginhawa.Group › Documents › Operations, but it won't work, for three reasons:

1. **The app saves checklists into SharePoint lists, and lists can only live on a site.** A folder can only hold files.
2. **Microsoft gives an app access to a whole site at a time.** If the app wrote into our Operations folder, it could change every document on Maginhawa.Group. With its own site, it can only touch its own data.
3. **Maginhawa.Group is a public group.** Food-safety records and photos of staff shouldn't be open to everyone in the organisation (UK GDPR).

The new site will hold:
- the app's lists, which keep each answer;
- a **Maginhawa App Checklists** folder with one PDF per restaurant per day and a monthly Excel file;
- a **Photos** folder.

People will still get to it from Operations through a shortcut.

---

### 1. Create the site (about 5 minutes)

1. Go to **admin.microsoft.com**, then **Admin centres → SharePoint**.
2. Go to **Sites → Active sites → + Create → Other options**.
3. Choose **Team site** with **no Microsoft 365 group**.
4. Fill it in:
   - **Site name:** `Maginhawa App`
   - **Address:** `/sites/MaginhawaApp`
   - **Primary admin:** me ([your email])
   - **Language:** English (UK). This can't be changed later.
   - **Time zone:** (UTC) London
5. Please don't add anyone else yet. I'll set up managers' access once the app has created the folders.

### 2. Register the app (about 10 minutes)

1. Go to **entra.microsoft.com**, then **Applications → App registrations → + New registration**.
   - **Name:** `Maginhawa App`
   - **Who can use it:** *Accounts in this organisational directory only*
   - **Redirect URI:** leave it blank. Click **Register**.
2. Note the **Application (client) ID** and the **Directory (tenant) ID** from the overview page.
3. Go to **API permissions → + Add a permission → Microsoft Graph → Application permissions**. Tick **Sites.Selected** and click **Add**.
4. Click **Grant admin consent**.
   - **Sites.Selected** on its own gives the app access to nothing. Step 3 below gives it this one site only.
5. Go to **Certificates & secrets → + New client secret**, with the description `Netlify` and an expiry of 12 months.
   - Copy the **Value** straight away. It's only shown once.

### 3. Give the app access to the new site only (about 5 minutes)

1. Open **Graph Explorer** (developer.microsoft.com/graph/graph-explorer) and sign in as admin.
2. Click **Modify permissions** and consent to **Sites.FullControl.All**. This lets Graph Explorer give out access; the app doesn't get it.
3. **Get the site ID.** Set the method to **GET** and run:
   ```
   https://graph.microsoft.com/v1.0/sites/<ourtenant>.sharepoint.com:/sites/MaginhawaApp
   ```
   Note the `"id"` value in the response.
4. **Give the app access.** Set the method to **POST**, run the address below, and paste the request body under it:
   ```
   https://graph.microsoft.com/v1.0/sites/<site id>/permissions
   ```
   ```json
   {
     "roles": ["fullcontrol"],
     "grantedToIdentities": [
       { "application": { "id": "<client ID>", "displayName": "Maginhawa App" } }
     ]
   }
   ```
   If it refuses `fullcontrol`, switch **v1.0** to **beta** and run it again.

The app only needs full control for the first setup, while it creates its lists and folders. Once that's done, could you lower it to **write**? I'll let you know when.

---

### What I need back from you

| Item | How to send it |
|---|---|
| Directory (tenant) ID | Email or Teams is fine |
| Application (client) ID | Email or Teams is fine |
| Site ID | Email or Teams is fine |
| **Client secret value** | **Not by email or chat, please.** Either enter it straight into Netlify yourself, or give it to me in person or through a password manager |

The secret will expire in 12 months, so please put a reminder in your calendar to make a new one 2 weeks before.

If anything looks different from these steps, send me a screenshot and I'll work it out. Happy to go through it together on a call too.

Thanks,
[Your name]
