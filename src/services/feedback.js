// Replace this adapter only after a persistence/privacy decision. Never claim a save.
export const feedbackService = {
  async submit() {
    return {
      saved: false,
      message:
        "Feedback collection is not available yet. Your response has not been sent or saved.",
    };
  },
};
