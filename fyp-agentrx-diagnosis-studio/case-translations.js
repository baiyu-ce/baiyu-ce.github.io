'use strict';

// English counterparts to the Chinese teaching examples in app.js.
// These are preset teaching examples, not model outputs or experimental results.
window.TRACE_DYNAMIC = {
  methods: [
    [
      '01 / TRACE',
      'Reconstruct what happened at each step',
      'Organize the task, agent messages, tool calls and responses into ordered steps. Keep step numbers so every later citation can be traced to its source.',
      'The tool returns “amount_minor: 129900, unit: fen” (1/100 yuan). Keep this record separate from the agent’s later claim of “129900 yuan”.',
      'Remove reference answer labels from the input to avoid leaking them into the diagnosis.'
    ],
    [
      '02 / CONSTRAINTS',
      'Turn requirements into checkable questions',
      'Define checks from the task requirements and tool semantics. State what each step must satisfy, rather than asking the model to comment freely on the whole trace.',
      'Report the amount in the unit the user requested. If the tool returns fen, convert the amount before reporting it in yuan.',
      'A constraint can itself be wrong. Check whether it applies to this task.'
    ],
    [
      '03 / VERIFICATION',
      'Separate passes, violations and uncertainty',
      'Check each constraint using only the trace visible up to that step. Require evidence that points back to the original record.',
      'CLEAR_PASS: the unit is correct. CLEAR_FAIL: the record clearly shows a unit error. UNCLEAR: the record does not provide enough information to judge.',
      'Do not use later steps to supply facts that were unavailable at the step being checked.'
    ],
    [
      '04 / REFLECTION',
      'Review the evidence, then filter the findings',
      'Check whether a finding relies on an incorrect constraint, missing evidence or an ambiguous interpretation. Filtering can reduce noise, but may also remove weak evidence that would help the diagnosis.',
      'This project asks whether retaining additional UNCLEAR findings changes the subsequent diagnosis.',
      'Reflection and filtering are part of the existing baseline. This project does not claim them as a new method.'
    ],
    [
      '05 / DIAGNOSIS',
      'Connect the critical step, cause and evidence',
      'Use the trace and verification findings to identify the critical failure step, failure category, explanation and citations. A reader can revisit the cited steps to check the conclusion.',
      'If a timeout at step 1 is recovered but a unit error at step 3 remains uncorrected, examine step 3 rather than focusing only on the timeout or final answer.',
      'A matching quotation confirms that the cited text exists. It does not prove that the explanation is correct.'
    ]
  ],
  cases: [
    {
      title: 'Is a recovered timeout still the critical failure?',
      key: null,
      steps: [
        [
          'Tool request times out',
          'Retrieval tool',
          'Request: price list\nTool response: timeout',
          'Keep this event in the trace, then check whether the task recovers.'
        ],
        [
          'Retry succeeds',
          'Retrieval tool',
          'Retry response: Product A, price 1299 yuan\nStatus: success',
          'Errors can be recovered. A timeout is not automatically the root cause of a final failure.'
        ],
        [
          'Price source is checked',
          'Review agent',
          'Checked return value: 1299 yuan\nSource and unit are consistent',
          'This is an explicit verification record. Success is not inferred merely from the absence of an error.'
        ],
        [
          'Correct price is reported',
          'Answer agent',
          'Final answer: Product A costs 1299 yuan.',
          'In this fictional trace, the initial timeout did not cause the final answer to fail.'
        ]
      ],
      heading: 'A recovered error should not automatically be labelled the critical failure.',
      explanation: 'Step 1 did fail, but step 2 retrieved the required data, and the later records are consistent with that data. In this preset teaching example, there is no evidence that the initial timeout caused a final failure.'
    },
    {
      title: 'The data was correct. Why was the answer wrong?',
      key: 2,
      steps: [
        [
          'Tool request times out',
          'Retrieval tool',
          'Request: price of Product A\nTool response: timeout',
          'An error occurred, but we still need to check whether the task recovers.'
        ],
        [
          'Amount data is retrieved',
          'Retrieval tool',
          'amount_minor: 129900\ncurrency: CNY\nunit: fen (1/100 yuan)',
          'The tool explicitly states the unit: fen (1/100 yuan). 129900 fen equals 1299 yuan (CNY 1299).'
        ],
        [
          'Amount unit is misinterpreted',
          'Analysis agent',
          'According to the tool response, Product A costs 129900 yuan.',
          'Compare this with the previous record: the number was copied directly, but its unit was changed.'
        ],
        [
          'Only the answer format is checked',
          'Review agent',
          'The sentence is complete and includes the product name, amount and currency.\nFormat check passed.',
          'Passing a format check does not establish that the amount was converted correctly.'
        ],
        [
          'Wrong amount reaches the final answer',
          'Answer agent',
          'Final answer: Product A costs 129900 yuan.',
          'The final answer carries forward the interpretation error from step 3.'
        ]
      ],
      heading: 'Examine step 3: the unit is first misinterpreted here.',
      explanation: 'The timeout at step 1 was recovered at step 2. Step 3 first treats fen as yuan, and that error remains uncorrected in the final answer. In this complete preset teaching example, step 3 is the critical failure to investigate first; step 5 is a downstream symptom.'
    },
    {
      title: 'No save record: does that mean nothing was saved?',
      key: null,
      steps: [
        [
          'Report save is requested',
          'Orchestrator agent',
          'Request: save the report as report.json\nTool response record: missing',
          'A missing response could mean the operation failed, or that the log is incomplete.'
        ],
        [
          'Report is claimed to be saved',
          'Writing agent',
          'The report has been saved successfully. We can proceed to the summary.',
          'The visible log contains no successful tool response to support this claim.'
        ],
        [
          'File read fails',
          'File-reading tool',
          'Read report.json\nResponse: File not found',
          'A failure is visible, but this record alone cannot rule out a different directory or a file deleted after saving.'
        ],
        [
          'Summary is halted',
          'Orchestrator agent',
          'The report content could not be retrieved. This summary attempt is halted.',
          'We can confirm that the summary stopped. The specific cause of the initial failure still needs more evidence.'
        ]
      ],
      heading: 'The evidence raises a concern, but does not establish a unique root cause.',
      explanation: 'A missing save record does not prove that the file was never saved. We can flag the unsupported success claim at step 2, but establishing the root cause requires the save response, actual path and file state. This teaching example calls for retaining UNCLEAR rather than forcing a definite answer.'
    }
  ]
};
