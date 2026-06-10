import React, { useState } from 'react';

interface OnboardingModalProps {
  onComplete: () => void;
}

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to LeadHarvester',
      content: (
        <>
          <p className="text-gray-600 mb-4">
            LeadHarvester helps you find business leads by searching Google Maps and
            extracting publicly visible contact information.
          </p>
          <div className="bg-primary-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-primary-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm">
                <p className="font-medium text-primary-800">100% Local & Free</p>
                <p className="text-primary-700">
                  All data is stored on your computer. No account needed, no paid APIs.
                </p>
              </div>
            </div>
          </div>
        </>
      ),
    },
    {
      title: 'How It Works',
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 font-bold">
              1
            </div>
            <div>
              <p className="font-medium text-gray-900">Create a Project</p>
              <p className="text-sm text-gray-500">
                Enter a search keyword (e.g., "restaurants") and location (e.g., "Chicago, IL")
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 font-bold">
              2
            </div>
            <div>
              <p className="font-medium text-gray-900">Run the Scraper</p>
              <p className="text-sm text-gray-500">
                LeadHarvester searches Google Maps and extracts business listings
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 font-bold">
              3
            </div>
            <div>
              <p className="font-medium text-gray-900">Enrich with Emails</p>
              <p className="text-sm text-gray-500">
                Visits each business website to find email addresses and contact pages
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 font-bold">
              4
            </div>
            <div>
              <p className="font-medium text-gray-900">Export & Use</p>
              <p className="text-sm text-gray-500">
                Filter results and export to CSV for your outreach campaigns
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Important Notice',
      content: (
        <>
          <div className="bg-yellow-50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="text-sm">
                <p className="font-medium text-yellow-800">Compliance Notice</p>
                <p className="text-yellow-700">
                  This tool only scrapes publicly visible information. You are responsible
                  for complying with:
                </p>
                <ul className="list-disc list-inside mt-2 text-yellow-700">
                  <li>Google's Terms of Service</li>
                  <li>Data protection laws (GDPR, CCPA, etc.)</li>
                  <li>Anti-spam regulations (CAN-SPAM, etc.)</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              <strong>Tips for responsible use:</strong>
            </p>
            <ul className="list-disc list-inside mt-2 text-sm text-gray-600 space-y-1">
              <li>Use "Safe Mode" to minimize detection</li>
              <li>Don't run massive searches in short periods</li>
              <li>Only contact businesses with legitimate offers</li>
              <li>Respect opt-out requests</li>
            </ul>
          </div>
        </>
      ),
    },
  ];

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 overflow-hidden animate-fadeIn">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 text-center mb-4">
            {currentStep.title}
          </h2>
          {currentStep.content}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex justify-between">
          <button
            onClick={() => setStep(step - 1)}
            className={`btn-secondary ${step === 0 ? 'invisible' : ''}`}
          >
            Back
          </button>
          {isLastStep ? (
            <button onClick={onComplete} className="btn-primary">
              Get Started
            </button>
          ) : (
            <button onClick={() => setStep(step + 1)} className="btn-primary">
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
