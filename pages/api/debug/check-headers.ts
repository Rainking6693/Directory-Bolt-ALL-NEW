import { NextApiRequest, NextApiResponse } from 'next';

const { createGoogleSheetsService } = require('../../../lib/services/google-sheets.js');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const googleSheetsService = createGoogleSheetsService();
    
    // Initialize sheets
    await googleSheetsService.initialize();
    
    // Get headers (first row)
    const response = await googleSheetsService.sheets.spreadsheets.values.get({
      spreadsheetId: googleSheetsService.spreadsheetId,
      range: 'A1:Z1'
    });
    
    const headers = response.data.values ? response.data.values[0] : [];
    
    // Also get the first few rows to see data structure
    const dataResponse = await googleSheetsService.sheets.spreadsheets.values.get({
      spreadsheetId: googleSheetsService.spreadsheetId,
      range: 'A1:Z5'
    });
    
    const rows = dataResponse.data.values || [];
    
    return res.status(200).json({
      success: true,
      headers,
      headerCount: headers.length,
      sampleData: rows,
      rawResponse: {
        majorDimension: response.data.majorDimension,
        range: response.data.range
      }
    });

  } catch (error) {
    console.error('Error checking headers:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}