# Market Neurons — Team Tasks

A Next.js + Firebase workspace for running a team: authentication, tasks on a kanban
board, hour tracking, per-task comments, member management and charts for all of it.

## Features

| Area | What you get |
| --- | --- |
| **Auth** | Email/password sign-up & sign-in, Google sign-in, password reset, protected routes |
| **Teams** | Create a team, join by invite code, invite by email, roles (owner / admin / member), multiple workspaces per user |
| **Tasks** | Kanban board with drag-and-drop, list view, search + assignee + priority filters, due dates, estimates |
| **Comments** | Threaded discussion on every task, live-updating, delete your own |
| **Hours** | Log time against a task or as general work, per-member and per-range filtering, editable entries |
| **Charts** | Hours trend, status split, hours by member, priority breakdown, top tasks by hours, workload per member |

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Firebase config lives in `.env.local` (already filled in for the `secretcomms-6de0e`
project). `.env.example` documents the variables for anyone else cloning the repo.

## Firebase Console setup

Three things must be enabled in the console before the app works:

1. **Authentication → Sign-in method** — enable **Email/Password** and **Google**.
2. **Authentication → Settings → Authorized domains** — add `localhost` and your
   deployed domain.
3. **Firestore Database** — create the database, then publish `firestore.rules`:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

Without the rules deployed, Firestore's default lock-mode denies every read and write.

## Data model

```
users/{uid}                        profile + teamIds
teamCodes/{CODE}                   invite-code → teamId lookup
teams/{teamId}                     name, ownerId, inviteCode, memberIds[], members{uid:{role,…}}
  tasks/{taskId}                   title, status, priority, assigneeId, dueDate,
                                   estimateHours, loggedHours, commentCount
    comments/{commentId}           text, authorId, authorName, createdAt
  timeLogs/{logId}                 taskId, userId, hours, date, note
invites/{teamId_email}             pending email invite, claimed on first sign-in
```

Everything the UI reads is a realtime `onSnapshot` subscription, so a task moved on
one screen updates every other screen and every chart immediately.

## Project layout

```
app/
  layout.js              root layout + AuthProvider
  login/ signup/         auth screens
  (app)/                 signed-in shell (sidebar + guard + WorkspaceProvider)
    dashboard/           KPIs and charts
    tasks/               board, list, and [taskId] detail with comments
    hours/               time entries and hour charts
    team/                members, roles, invites, workload chart
    settings/            profile, team, workspace switching
components/              providers, shared UI, modals
lib/                     firebase, firestore data layer, analytics, constants
```

## Roles

- **Owner** — created the team; can do everything, cannot be removed or demoted.
- **Admin** — manage members, rename the team, delete any task.
- **Member** — create and work on tasks, comment, log hours.
# market-neurons-tasks
