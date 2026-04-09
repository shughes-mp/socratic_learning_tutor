# 🎨 Socratic Art Learning Tutor (MVP)

Welcome to the **Socratic Art Learning Tutor**! This project is an AI-powered conversational platform designed to teach art concepts through the **Socratic method**. Rather than just giving you the answers, it asks thought-provoking questions, guiding you to discover insights on your own—just like a real instructor!

## 🌟 What Does This MVP Do?

This Minimum Viable Product (MVP) provides a comprehensive environment for both students and instructors:

### For Students (The Learning Experience)
* **Interactive Socratic Chat**: Engage in deep, guided dialogue with an AI tutor that focuses on art history, theory, and techniques. 
* **Adaptive Learning**: The tutor senses your level of understanding. If you're struggling, it provides hints. If you grasp the concept, it challenges you further.
* **Direct Answers Unlock**: After multiple genuine attempts, if you're still stuck, the system unlocks direct, clarifying answers so you never remain frustrated.

### For Instructors (The Dashboard)
* **Live Session Monitoring**: Watch student interactions and progress in real-time.
* **Readiness Heatmaps**: Instantly see which students are excelling and who might need extra help based on their conversational engagement and AI-assessed understanding.
* **Automated AI Debriefs**: Generate comprehensive PDF reports that summarize student misconceptions, key learning moments, and suggested future teaching strategies.
* **Custom Configuration**: Upload custom course readings (PDFs, Markdown, text) and quizzes to tailor the AI's knowledge purely to your curriculum.

## 🚀 How It Works (Behind the Scenes)

This modern web application is built with **Next.js** and styled with **Tailwind CSS**, providing a sleek, responsive, and seamless experience. It leverages **Anthropic's Claude AI** to power the high-quality, nuanced Socratic questioning.

1. **Upload Content**: Instructors upload curriculum materials.
2. **AI Processing**: The system indexes the content.
3. **Student Engagement**: Students chat with the AI based exclusively on the uploaded materials.
4. **Analytics Extraction**: The platform analyzes chat logs to build actionable insights for educators.

## 🛠️ Setup & Installation

To run the Socratic Tutor Next.js Application locally:

1. **Navigate to the web app directory**:
   ```bash
   cd socratic-tutor
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the template or create a `.env` file in the `socratic-tutor` folder and add your API keys:
   ```env
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to view the application!

*(Note: There is also an early Python-based prototype included in the root directory for reference, but the Next.js `socratic-tutor` folder contains the primary interactive MVP).*

## 💡 Why We Built This

Traditional learning often relies on passive reading. We believe active engagement is the key to retention—especially in subjective and interpretative fields like Art. By challenging learners to articulate their thoughts and defend their perspectives, this tool turns passive readers into active thinkers.
