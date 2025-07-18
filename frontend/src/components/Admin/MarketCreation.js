import React, { useState } from 'react';
import { FiPlus, FiCalendar, FiTag, FiFileText, FiGlobe, FiCheck, FiX } from 'react-icons/fi';
import adminService from '../../services/adminService';
import './MarketCreation.css';

const MarketCreation = ({ onMarketCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    endDate: '',
    tags: '',
    resolutionCriteria: '',
    resolutionSource: '',
    minBetAmount: '0.01',
    maxBetAmount: '1000.00'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});

  const categories = [
    { value: 'politics', label: 'Politics', icon: '🏛️' },
    { value: 'sports', label: 'Sports', icon: '⚽' },
    { value: 'crypto', label: 'Crypto', icon: '₿' },
    { value: 'tech', label: 'Technology', icon: '💻' },
    { value: 'culture', label: 'Culture', icon: '🎭' },
    { value: 'world', label: 'World', icon: '🌍' },
    { value: 'economy', label: 'Economy', icon: '📈' },
    { value: 'elections', label: 'Elections', icon: '🗳️' },
    { value: 'entertainment', label: 'Entertainment', icon: '🎬' },
    { value: 'science', label: 'Science', icon: '🔬' },
    { value: 'other', label: 'Other', icon: '📝' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length < 10) {
      newErrors.title = 'Title must be at least 10 characters long';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 20) {
      newErrors.description = 'Description must be at least 20 characters long';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    } else {
      const endDate = new Date(formData.endDate);
      const now = new Date();
      if (endDate <= now) {
        newErrors.endDate = 'End date must be in the future';
      }
    }

    if (!formData.resolutionCriteria.trim()) {
      newErrors.resolutionCriteria = 'Resolution criteria is required';
    }

    const minBet = parseFloat(formData.minBetAmount);
    const maxBet = parseFloat(formData.maxBetAmount);

    if (isNaN(minBet) || minBet <= 0) {
      newErrors.minBetAmount = 'Minimum bet amount must be greater than 0';
    }

    if (isNaN(maxBet) || maxBet <= 0) {
      newErrors.maxBetAmount = 'Maximum bet amount must be greater than 0';
    }

    if (!isNaN(minBet) && !isNaN(maxBet) && minBet >= maxBet) {
      newErrors.maxBetAmount = 'Maximum bet amount must be greater than minimum bet amount';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const marketData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        endDate: new Date(formData.endDate).toISOString(),
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        resolutionCriteria: formData.resolutionCriteria.trim(),
        resolutionSource: formData.resolutionSource.trim() || 'Manual resolution',
        minBetAmount: parseFloat(formData.minBetAmount),
        maxBetAmount: parseFloat(formData.maxBetAmount)
      };

      const result = await adminService.createMarket(marketData);

      if (result.success) {
        setMessage('Market created successfully!');

        // Reset form
        setFormData({
          title: '',
          description: '',
          category: '',
          endDate: '',
          tags: '',
          resolutionCriteria: '',
          resolutionSource: '',
          minBetAmount: '0.01',
          maxBetAmount: '1000.00'
        });

        // Call callback if provided
        if (onMarketCreated) {
          onMarketCreated(result.market);
        }
      } else {
        setMessage('Failed to create market: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating market:', error);
      setMessage('Error creating market: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      title: '',
      description: '',
      category: '',
      endDate: '',
      tags: '',
      resolutionCriteria: '',
      resolutionSource: '',
      minBetAmount: '0.01',
      maxBetAmount: '1000.00'
    });
    setErrors({});
    setMessage('');
  };

  return (
    <div className="market-creation">
      <div className="market-creation-header">
        <h2>Create New Market</h2>
        <p>Create a new prediction market for users to trade on</p>
      </div>

      <form onSubmit={handleSubmit} className="market-creation-form">
        <div className="form-section">
          <h3>Basic Information</h3>

          <div className="form-group">
            <label htmlFor="title">
              <FiFileText className="label-icon" />
              Market Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Will Bitcoin reach $100,000 by end of 2024?"
              maxLength={200}
              disabled={loading}
            />
            {errors.title && <div className="error-text">{errors.title}</div>}
            <div className="char-count">{formData.title.length}/200</div>
          </div>

          <div className="form-group">
            <label htmlFor="description">
              <FiFileText className="label-icon" />
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Provide a detailed description of the market conditions and what constitutes a YES or NO outcome..."
              rows="4"
              maxLength={1000}
              disabled={loading}
            />
            {errors.description && <div className="error-text">{errors.description}</div>}
            <div className="char-count">{formData.description.length}/1000</div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">
                <FiTag className="label-icon" />
                Category *
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
              {errors.category && <div className="error-text">{errors.category}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="endDate">
                <FiCalendar className="label-icon" />
                End Date *
              </label>
              <input
                type="datetime-local"
                id="endDate"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                disabled={loading}
              />
              {errors.endDate && <div className="error-text">{errors.endDate}</div>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="tags">
              <FiTag className="label-icon" />
              Tags (comma-separated)
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="bitcoin, cryptocurrency, price prediction"
              disabled={loading}
            />
            <div className="help-text">
              Add relevant tags to help users find this market
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Trading Parameters</h3>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="minBetAmount">
                Minimum Bet Amount (MNT) *
              </label>
              <input
                type="number"
                id="minBetAmount"
                name="minBetAmount"
                value={formData.minBetAmount}
                onChange={handleChange}
                step="0.01"
                min="0.01"
                disabled={loading}
              />
              {errors.minBetAmount && <div className="error-text">{errors.minBetAmount}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="maxBetAmount">
                Maximum Bet Amount (MNT) *
              </label>
              <input
                type="number"
                id="maxBetAmount"
                name="maxBetAmount"
                value={formData.maxBetAmount}
                onChange={handleChange}
                step="0.01"
                min="0.01"
                disabled={loading}
              />
              {errors.maxBetAmount && <div className="error-text">{errors.maxBetAmount}</div>}
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Resolution Details</h3>

          <div className="form-group">
            <label htmlFor="resolutionCriteria">
              <FiCheck className="label-icon" />
              Resolution Criteria *
            </label>
            <textarea
              id="resolutionCriteria"
              name="resolutionCriteria"
              value={formData.resolutionCriteria}
              onChange={handleChange}
              placeholder="Describe exactly how this market will be resolved. What sources will be used? What constitutes a YES vs NO outcome?"
              rows="4"
              maxLength={500}
              disabled={loading}
            />
            {errors.resolutionCriteria && <div className="error-text">{errors.resolutionCriteria}</div>}
            <div className="char-count">{formData.resolutionCriteria.length}/500</div>
          </div>

          <div className="form-group">
            <label htmlFor="resolutionSource">
              <FiGlobe className="label-icon" />
              Resolution Source
            </label>
            <input
              type="text"
              id="resolutionSource"
              name="resolutionSource"
              value={formData.resolutionSource}
              onChange={handleChange}
              placeholder="CoinGecko, Official announcement, News sources, etc."
              disabled={loading}
            />
            <div className="help-text">
              Specify the authoritative source that will be used for resolution
            </div>
          </div>
        </div>

        {message && (
          <div className={`form-message ${message.includes('successfully') ? 'success' : 'error'}`}>
            {message.includes('successfully') ? <FiCheck /> : <FiX />}
            {message}
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="reset-button"
            onClick={handleReset}
            disabled={loading}
          >
            Reset Form
          </button>

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            <FiPlus />
            {loading ? 'Creating...' : 'Create Market'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MarketCreation;