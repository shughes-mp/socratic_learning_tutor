export function StepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const steps = [
    { number: 1 as const, label: "Name it" },
    { number: 2 as const, label: "Add a reading" },
    { number: 3 as const, label: "Share the link" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-y-2">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                step.number === currentStep
                  ? "bg-[var(--teal)] text-white"
                  : step.number < currentStep
                    ? "bg-[var(--teal)] text-white opacity-40"
                    : "border border-[var(--rule)] text-[var(--dim-grey)]"
              }`}
            >
              {step.number < currentStep ? (
                <svg
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                step.number
              )}
            </div>
            <span
              className={`text-[12px] ${
                step.number === currentStep
                  ? "font-semibold text-[var(--charcoal)]"
                  : "text-[var(--dim-grey)]"
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className="mx-3 h-px w-8 bg-[var(--rule)]" />
          )}
        </div>
      ))}
    </div>
  );
}
