# AADI — static site + Firebase (Auth + Firestore)

Plain HTML / CSS / JS. No build step. Works on Vercel (or any static host).

## 1. Firebase setup (5 minutes)
1. https://console.firebase.google.com -> **Add project**.
2. **Build -> Authentication -> Get started -> Sign-in method -> Email/Password -> Enable.**
3. **Build -> Firestore Database -> Create database** (production mode, any region).
4. **Firestore -> Rules** -> paste the contents of `firestore.rules` -> **Publish**.
5. **Project settings -> General -> Your apps -> Web (`</>`)** -> register app -> copy the `firebaseConfig`.
6. Paste those values in `assets/js/firebase-config.js`.
7. **Authentication -> Settings -> Authorized domains** -> add your Vercel domain (e.g. `your-site.vercel.app`) and your custom domain.

Until step 6 is done the site runs in **preview mode** (design only, login does not work).

> **Kuch kaam na kare to pehle `https://<aapki-site>/check.html` kholein** — wo config, SDK, Firestore rules, Email/Password aur
> authorized domain ek-ek karke check karke bata deta hai ki kya baaki hai.

## 2. Deploy on Vercel
1. Upload everything in this folder to the **root** of a GitHub repo (`index.html` must be at the repo root).
2. Vercel -> Add New -> Project -> import the repo. Framework preset **Other**. Build command and output directory: leave empty. Deploy.

## 3. Logins
| Role | Where created | Login with |
|---|---|---|
| Institute | `register.html?as=institute` | Institute Code (BRxxxxxx) / mobile / email |
| Student | `register.html?as=student` or added by the institute | Enrollment No. (VSxxxxxxxxxx) / mobile / email |
| Teacher | Institute panel -> Teachers / Staff Logins | Staff ID (TCxxxxxx) / mobile / email |

Login page has three tabs; the account type must match the tab.

## 4. What is connected to Firebase
Register / login / logout / forgot password, institute + student + teacher dashboards, add student, student list + approvals, courses,
notices, teachers, online admission form, generate documents (certificate, marksheet, ID card, admit card, TC, bonafide ...), public
verify + print view, attendance, fee receipts + dues, UPI QR, institute profile + KYC, affiliation request, referrals, sub-franchise,
tickets, join institute, online-course enrolment, centres list, franchise enquiry, free tools.

## 5. Not connected yet (UI only)
Bulk Excel import / bulk certificates, online exam builder, certificate designs / rules, trash, online payments / wallet recharge,
photo / logo / signature uploads (needs Firebase Storage), email / SMS sending.

## Data (Firestore collections)
users, institutes, students, memberships, staff, courses, notices, attendance, fees, documents, tickets, admissions,
franchiseEnquiries, affiliations, subFranchises, enrollments, loginIndex.
Affiliation approval and franchise enquiries are read / changed in the Firebase Console.

## Login nahi ho raha? (troubleshooting)
| Dikhne wali cheez | Matlab / fix |
|---|---|
| "Firebase config detect nahi hua" | `assets/js/firebase-config.js` mein config daala? File GitHub par push karke Vercel ka naya deploy hua? Phir Ctrl+F5. |
| "Permission nahi mili" | Firestore -> Rules mein `firestore.rules` paste karke **Publish** karein. |
| "Authorized domains…" | Authentication -> Settings -> Authorized domains mein apna Vercel domain add karein. |
| "Email/Password enable karein" | Authentication -> Sign-in method -> Email/Password -> Enable. |
| Register adhoora reh gaya | Wahi email + password se dobara register karein, adhoori registration poori ho jayegi. |
| Page ki script load nahi hui | Site ko file se double-click karke nahi, https/localhost se kholein. |
