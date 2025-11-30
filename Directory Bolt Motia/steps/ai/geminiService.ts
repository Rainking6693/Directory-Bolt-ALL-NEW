// AI service for Google Gemini API integration
export class GeminiService {
  private apiKey: string;
  private baseUrl: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }
  
  async generateFieldMapping(prompt: string, businessData: any, directoryInfo: any) {
    const response = await fetch(
      `${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Given this business data: ${JSON.stringify(businessData)}
                     And this directory information: ${JSON.stringify(directoryInfo)}
                     ${prompt}`
            }]
          }]
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }
    
    const data: any = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
}