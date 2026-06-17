import { doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { InstituteSettings } from "@/types/erp";

const SETTINGS_DOC = "institute";

export const DEFAULT_SETTINGS: InstituteSettings = {
  instituteName: "Vivexa Institute of Technology",
  email: "contact@vivexatech.in",
  phone: "+919582194338",
  whatsapp: "+919582194338",
  website: "https://vivexatech.in",
  address: "",
  facebook: "",
  instagram: "",
  twitter: "",
  youtube: "",
};

export function subscribeToSettings(
  callback: (settings: InstituteSettings) => void
): Unsubscribe {
  return onSnapshot(doc(db, "appConfig", SETTINGS_DOC), (snap) => {
    if (snap.exists()) {
      callback({ ...DEFAULT_SETTINGS, ...snap.data() } as InstituteSettings);
    } else {
      callback(DEFAULT_SETTINGS);
    }
  });
}

export async function saveSettings(settings: InstituteSettings) {
  await setDoc(
    doc(db, "appConfig", SETTINGS_DOC),
    { ...settings, updatedAt: serverTimestamp() },
    { merge: true }
  );
  await setDoc(
    doc(db, "appConfig", "main"),
    {
      supportEmail: settings.email,
      supportPhone: settings.phone,
      supportWhatsApp: settings.whatsapp,
      instituteName: settings.instituteName,
      website: settings.website,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
