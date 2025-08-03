"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  category: "execution" | "options" | "risk_management" | "custom";
  parameters: {
    name: string;
    type: "string" | "number" | "boolean" | "object";
    required: boolean;
    description: string;
    defaultValue?: any;
  }[];
  features: string[];
  riskLevel: "low" | "medium" | "high";
  estimatedGas: string;
  complexity: "simple" | "intermediate" | "advanced";
}

/**
 * Hook for fetching and managing strategy templates
 * Based on 1inch Limit Order Protocol documentation
 */

export function useStrategyTemplates() {
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // Fetch strategy templates
  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/api/enhanced-strategies/templates`);

      if (response.data.success) {
        setTemplates(response.data.templates || []);
      } else {
        throw new Error(response.data.message || "Failed to fetch strategy templates");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to fetch strategy templates");
      console.error("Error fetching strategy templates:", err);
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL]);

  // Get template by ID
  const getTemplateById = useCallback((templateId: string) => {
    return templates.find(template => template.id === templateId);
  }, [templates]);

  // Get templates by category
  const getTemplatesByCategory = useCallback((category: string) => {
    return templates.filter(template => template.category === category);
  }, [templates]);

  // Get templates by complexity
  const getTemplatesByComplexity = useCallback((complexity: string) => {
    return templates.filter(template => template.complexity === complexity);
  }, [templates]);

  // Get templates by risk level
  const getTemplatesByRiskLevel = useCallback((riskLevel: string) => {
    return templates.filter(template => template.riskLevel === riskLevel);
  }, [templates]);

  // Initial data fetch
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    // State
    templates,
    isLoading,
    error,

    // Actions
    fetchTemplates,
    getTemplateById,
    getTemplatesByCategory,
    getTemplatesByComplexity,
    getTemplatesByRiskLevel
  };
}