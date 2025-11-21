import React, { useState } from 'react';

const TestForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('TEST FORM SUBMITTED!', { email, password });
    alert('Form submitted! Check console.');
  };

  const handleButtonClick = () => {
    console.log('TEST BUTTON CLICKED!');
    alert('Button clicked!');
  };

  return (
    <div className="min-h-screen p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Form</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
            required
          />
        </div>
        
        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          Submit Form
        </button>
        
        <button
          type="button"
          onClick={handleButtonClick}
          className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600"
        >
          Test Button Click
        </button>
      </form>
    </div>
  );
};

export default TestForm;