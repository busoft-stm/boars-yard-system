/**
 * Figma Plugin API script — wire Smart Yard prototype interactions.
 * Run via MCP use_figma against fileKey Z1tWebB0pue0WuWzlkjym1
 */
const NAV_LABELS = {
  Dashboard: 'Dashboard',
  Users: 'Users',
  Yards: 'Yards',
  Docks: 'Docks',
  Trailers: 'Trailers',
  'Trailer Devices': 'Trailer Devices',
  Infrastructure: 'Infrastructure',
  'Infrastructure V2': 'Infrastructure',
  Gates: 'Gates',
  'Cold Chain': 'Cold Chain',
  Analytics: 'Analytics',
  Insights: 'Insights',
  Integrations: 'Integrations',
  Exceptions: 'Exceptions',
  Movement: 'Movements',
  Movements: 'Movements',
}

const HEADER_LABELS = {
  Exceptions: 'Exceptions',
  Movement: 'Movements',
}

const MOBILE_LABELS = {
  Home: 'Mobile Home',
  Scan: 'Mobile Scan',
  Inspect: 'Mobile Inspect',
  Alerts: 'Mobile Alerts',
  Map: 'Mobile Map',
}

const transition = {
  type: 'DISSOLVE',
  easing: { type: 'EASE_OUT' },
  duration: 0.2,
}

function navReaction(destinationId) {
  return {
    trigger: { type: 'ON_CLICK' },
    actions: [
      {
        type: 'NODE',
        destinationId,
        navigation: 'NAVIGATE',
        transition,
      },
    ],
  }
}

function findPageTitle(frame) {
  const signIn = frame.findOne(
    (n) =>
      n.type === 'TEXT' &&
      typeof n.characters === 'string' &&
      /sign in/i.test(n.characters),
  )
  if (signIn) return 'Login'

  const headings = frame.findAll(
    (n) => n.type === 'TEXT' && n.name === 'h1',
  )
  if (headings.length) {
    const title = headings[0].characters
    if (/boar/i.test(title) && frame.findOne((n) => n.type === 'TEXT' && /sign in/i.test(n.characters)))
      return 'Login'
    return title
  }
  const h1ish = frame.findAll(
    (n) =>
      n.type === 'TEXT' &&
      typeof n.characters === 'string' &&
      n.characters.length > 2 &&
      n.characters.length < 40 &&
      typeof n.fontSize === 'number' &&
      n.fontSize >= 28,
  )
  return h1ish[0]?.characters ?? null
}

function isMobileFrame(frame) {
  return (
    frame.width < 500 ||
    !!frame.findOne((n) => n.name === 'm-tabbar' || n.name === 'Mobile')
  )
}

const page = figma.root.children[0]
await figma.setCurrentPageAsync(page)
page.name = 'Smart Yard — Interactive Template'

const topFrames = page.children.filter(
  (n) => n.type === 'FRAME' || n.type === 'COMPONENT',
)

const screenMap = {}
for (const frame of topFrames) {
  const title = findPageTitle(frame)
  const mobile = isMobileFrame(frame)
  let key = title
  if (!key && mobile) key = 'Mobile Screen'
  if (!key) key = frame.name
  let unique = key
  let i = 2
  while (screenMap[unique]) {
    unique = `${key} (${i++})`
  }
  frame.name = unique
  screenMap[unique] = frame.id
}

const loginFrameId =
  Object.entries(screenMap).find(([k]) => /login/i.test(k))?.[1] ??
  screenMap['Sign in'] ??
  screenMap['Login']

let wired = 0
const errors = []

for (const frame of topFrames) {
  const links = frame.findAll((n) => n.name === 'Link')
  for (const link of links) {
    const labelNode = link.findOne(
      (n) =>
        n.type === 'TEXT' &&
        (NAV_LABELS[n.characters] || HEADER_LABELS[n.characters]),
    )
    if (!labelNode) continue
    const label = labelNode.characters
    const destName = NAV_LABELS[label] || HEADER_LABELS[label]
    const destId = screenMap[destName]
    if (!destId || destId === frame.id) continue
    try {
      await link.setReactionsAsync([navReaction(destId)])
      wired += 1
    } catch (e) {
      errors.push({ link: link.id, label, error: String(e) })
    }
  }

  const mobileTabs = frame.findAll(
    (n) => n.name === 'm-tab' || n.name === 'Link',
  )
  for (const tab of mobileTabs) {
    const labelNode = tab.findOne(
      (n) =>
        n.type === 'TEXT' &&
        MOBILE_LABELS[n.characters],
    )
    if (!labelNode) continue
    const destId = screenMap[MOBILE_LABELS[labelNode.characters]]
    if (!destId || destId === frame.id) continue
    try {
      await tab.setReactionsAsync([navReaction(destId)])
      wired += 1
    } catch (e) {
      errors.push({ tab: tab.id, label: labelNode.characters, error: String(e) })
    }
  }
}

if (loginFrameId) {
  const loginFrame = figma.getNodeById(loginFrameId)
  if (loginFrame) {
    const signInBtn = loginFrame.findOne(
      (n) =>
        (n.name === 'Button' || n.name === 'button') &&
        n.findOne(
          (t) =>
            t.type === 'TEXT' &&
            /sign in/i.test(t.characters),
        ),
    )
    const dashboardId = screenMap['Dashboard']
    if (signInBtn && dashboardId) {
      try {
        await signInBtn.setReactionsAsync([navReaction(dashboardId)])
        wired += 1
      } catch (e) {
        errors.push({ login: signInBtn.id, error: String(e) })
      }
    }
  }
  if ('flowStartingPoints' in page) {
    page.flowStartingPoints = [{ nodeId: loginFrameId, name: 'Login' }]
  }
}

let x = 0
let y = 0
const gap = 120
const rowH = 0
for (const frame of topFrames) {
  frame.x = x
  frame.y = y
  x += frame.width + gap
  if (x > 12000) {
    x = 0
    y += Math.max(rowH, frame.height) + gap
  }
}

return {
  screenMap,
  loginFrameId,
  wired,
  frameCount: topFrames.length,
  errors,
}
