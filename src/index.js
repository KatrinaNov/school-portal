// Load legacy app scripts in a deterministic order, in the global scope,
// so they keep working exactly like with <script src="..."> tags.
// Webpack modules are scoped, so we use script-loader to preserve globals.

import "script-loader!../assets/js/data.js";
import "script-loader!../assets/js/utils/safeHtml.js";
import "script-loader!../assets/js/contentAdapter.js";
import "script-loader!../assets/js/api.js";
import "script-loader!../assets/js/dataProvider.js";
import "script-loader!../assets/js/state.js";
import "script-loader!../assets/js/app.js";
import "script-loader!../assets/js/paragraph.js";
import "script-loader!../assets/js/quizEngine.js";
import "script-loader!../assets/js/quizGenerators/fromDates.js";
import "script-loader!../assets/js/quizGenerators/fromTerms.js";
import "script-loader!../assets/js/quizGenerators/fromPeople.js";
import "script-loader!../assets/js/quizGenerators/index.js";
import "script-loader!../assets/js/quiz.js";
import "script-loader!../assets/js/user.js";

// Optional Firebase auth (guest mode remains default).
import "./auth.js";

// Optional Firestore content provider (Firestore-first for signed-in users, JSON fallback).
import { installFirebaseDataProvider } from "./services/dataProviderFirebase";
installFirebaseDataProvider();

// Expose Firestore stats to legacy code.
import * as FirestoreStats from "./services/firestoreStats";
if (typeof window !== "undefined") window.FirestoreStats = FirestoreStats;

