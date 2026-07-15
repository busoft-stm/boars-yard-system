import { deviceAssignmentSteps } from '../data/smartEnterprise'

/** Visual attachment workflow — matches existing panel / eyebrow language. */
export function DeviceAssignmentWorkflow({
  activeStep = 0,
}: {
  activeStep?: number
}) {
  return (
    <div className="smart-workflow">
      <div className="panel-head">
        <h2>Device assignment workflow</h2>
        <span className="panel-meta">Gate → yard activation</span>
      </div>
      <ol className="smart-workflow-steps">
        {deviceAssignmentSteps.map((step, i) => (
          <li
            key={step}
            className={`smart-workflow-step ${i === activeStep ? 'active' : ''} ${i < activeStep ? 'done' : ''}`}
          >
            <strong>{i + 1}</strong>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
