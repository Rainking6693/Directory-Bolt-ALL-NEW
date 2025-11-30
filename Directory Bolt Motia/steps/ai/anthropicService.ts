// AI service for Anthropic API integration
export class AnthropicService {
  private apiKey: string;
  private baseUrl: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.anthropic.com/v1';
  }
  
  async generateFieldMapping(prompt: string, businessData: any, directoryInfo: any) {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-opus-20240229",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Given this business data: ${JSON.stringify(businessData)}
                     And this directory information: ${JSON.stringify(directoryInfo)}
                     ${prompt}`
          }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }
    
    const data: any = await response.json();
    return data.content[0].text;
  }
}