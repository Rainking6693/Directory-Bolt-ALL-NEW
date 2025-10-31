// Customer Validation Component
// Converts extension popup functionality to React dashboard component

import React, { useState } from "react";

interface CustomerData {
  customerId: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  packageTier: string;
  directoryLimit: number;
  email?: string;
  phone?: string;
}

interface ValidationResult {
  success: boolean;
  data?: CustomerData;
  error?: string;
}

export default function CustomerValidation(): JSX.Element {
  const [customerId, setCustomerId] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  const validateCustomerId = async () => {
    const trimmedId = customerId.trim();

    // Validate format: DIR-YYYYMMDD-XXXXXX
    if (!/^DIR-\d{8}-\d{6}$/i.test(trimmedId)) {
      setResult({
        success: false,
        error: "Customer ID must look like: DIR-YYYYMMDD-XXXXXX",
      });
      return;
    }

    setValidating(true);
    setResult(null);

    try {
      const storedAuth = localStorage.getItem("staffAuth");
      if (!storedAuth) {
        throw new Error("Staff authentication required");
      }

      const headers = {
        Authorization: `Bearer ${storedAuth}`,
      };

      const response = await fetch(
        `/api/customers/validate?customerId=${encodeURIComponent(trimmedId)}`,
        {
          headers,
        },
      );

      if (!response.ok) {
        throw new Error("Failed to validate customer");
      }

      const apiResult = await response.json();

      if (apiResult.success && apiResult.data) {
        const customer = apiResult.data;
        setResult({
          success: true,
          data: {
            customerId: trimmedId,
            firstName: customer.firstName,
            lastName: customer.lastName,
            businessName: customer.businessName,
            packageTier: getPackageTierName(customer.packageSize || 0),
            directoryLimit: customer.packageSize || 0,
            email: customer.email,
            phone: customer.phone,
          },
        });
      } else {
        setResult({
          success: false,
          error: apiResult.error || "Customer validation failed",
        });
      }
    } catch (error) {
      console.error("Customer validation error:", error);
      setResult({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Validation failed. Please try again later.",
      });
    } finally {
      setValidating(false);
    }
  };

  const getPackageTierName = (size: number): string => {
    switch (size) {
      case 50:
        return "Starter (50)";
      case 100:
        return "Growth (100)";
      case 300:
        return "Professional (300)";
      case 500:
        return "Enterprise (500)";
      default:
        return `Custom (${size})`;
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && customerId.trim() && !validating) {
      validateCustomerId();
    }
  };

  return (
    <div className="bg-secondary-900/60 border border-secondary-800 rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-volt-400 mb-2">
          Customer Validation
        </h3>
        <p className="text-secondary-400 text-sm">
          Enter a customer ID to check package details and directory limits.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="customerIdInput"
            className="block text-sm font-medium text-secondary-300 mb-2"
          >
            Customer ID
          </label>
          <div className="flex gap-3">
            <input
              id="customerIdInput"
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="DIR-YYYYMMDD-XXXXXX"
              className="flex-1 px-4 py-2 bg-secondary-800/50 border border-secondary-700 rounded-md 
                         text-secondary-100 placeholder-secondary-500 focus:outline-none 
                         focus:border-volt-500/50 focus:ring-2 focus:ring-volt-500/20"
              disabled={validating}
            />
            <button
              onClick={validateCustomerId}
              disabled={!customerId.trim() || validating}
              className="px-6 py-2 bg-volt-600 hover:bg-volt-700 disabled:bg-secondary-700 
                         disabled:text-secondary-500 text-white font-medium rounded-md 
                         transition-colors duration-200"
            >
              {validating ? "Validating..." : "Validate"}
            </button>
          </div>
        </div>

        {/* Results Display */}
        {result && (
          <div
            className={`p-4 rounded-md border ${
              result.success
                ? "bg-green-500/10 border-green-500/30 text-green-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            {result.success && result.data ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-400">
                    ✅ Customer Validated
                  </span>
                  <span className="text-xs text-secondary-400">
                    {result.data.customerId}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <div className="text-secondary-400 text-xs font-medium">
                      CUSTOMER INFO
                    </div>
                    <div className="text-secondary-200">
                      {[result.data.firstName, result.data.lastName]
                        .filter(Boolean)
                        .join(" ") || "(Name not provided)"}
                    </div>
                    {result.data.businessName && (
                      <div className="text-secondary-300 text-xs">
                        Business: {result.data.businessName}
                      </div>
                    )}
                    {result.data.email && (
                      <div className="text-secondary-300 text-xs">
                        Email: {result.data.email}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-secondary-400 text-xs font-medium">
                      PACKAGE DETAILS
                    </div>
                    <div className="text-volt-300 font-medium">
                      {result.data.packageTier}
                    </div>
                    <div className="text-secondary-300 text-xs">
                      Directory Limit: {result.data.directoryLimit}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <span className="text-red-400 font-medium text-sm">❌</span>
                <div className="text-sm">{result.error}</div>
              </div>
            )}
          </div>
        )}

        {/* Helpful Information */}
        <div className="text-xs text-secondary-500 p-3 bg-secondary-800/30 rounded">
          <strong className="text-secondary-400">Format:</strong> Customer IDs
          follow the pattern DIR-YYYYMMDD-XXXXXX where YYYY is year, MM is
          month, DD is day, and XXXXXX is a 6-digit sequence number.
        </div>
      </div>
    </div>
  );
}
