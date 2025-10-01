"use client";

import * as React from "react";

export default function LoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const testAccounts = [
    { email: "admin@ekko.earth", role: "National Admin", access: "ALL users" },
    {
      email: "london.manager@ekko.earth",
      role: "London Manager",
      access: "London branches only",
    },
    {
      email: "manchester.manager@ekko.earth",
      role: "Manchester Manager",
      access: "Manchester branches only",
    },
    {
      email: "westminster.staff@ekko.earth",
      role: "Westminster Staff",
      access: "Westminster branch only",
    },
    {
      email: "camden.staff@ekko.earth",
      role: "Camden Staff",
      access: "Camden branch only",
    },
    {
      email: "citycentre.staff@ekko.earth",
      role: "City Centre Staff",
      access: "City Centre branch only",
    },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apollo-require-preflight": "true",
        },
        body: JSON.stringify({
          query: `
            mutation Login($email: String!, $password: String!) {
              login(input: { email: $email, password: $password }) {
                token
                user {
                  id
                  name
                  email
                  organizationNode {
                    name
                    level
                  }
                }
                expiresAt
              }
            }
          `,
          variables: { email, password },
        }),
      });

      const result = await response.json();

      if (result.errors) {
        setError(result.errors[0].message);
      } else {
        const { token, user } = result.data.login;

        // Store token in localStorage (in production, use httpOnly cookies)
        localStorage.setItem("authToken", token);

        setSuccess(`✅ Login successful! Welcome, ${user.name}`);
        setError("");

        // Redirect to GraphQL playground with auth header instructions
        setTimeout(() => {
          window.open("/api/graphql", "_blank");
        }, 2000);
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = (testEmail: string) => {
    setEmail(testEmail);
    setPassword("Password123!");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Login & Test Permissions
        </h1>
        <p className="mt-2 text-gray-600">
          Test hierarchical access control with different user roles
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">🔐 Login</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              {success}
              <br />
              <small className="text-green-600">
                Opening GraphQL Playground in 2 seconds...
              </small>
            </div>
          )}

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              All test accounts use password:{" "}
              <code className="bg-gray-100 px-1 rounded">Password123!</code>
            </p>
          </div>
        </div>

        {/* Test Accounts */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">👥 Test Accounts</h2>

          <div className="space-y-3">
            {testAccounts.map((account) => (
              <div
                key={account.email}
                className="border border-gray-200 rounded-md p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => quickLogin(account.email)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">
                      {account.role}
                    </div>
                    <div className="text-sm text-gray-600">{account.email}</div>
                    <div className="text-xs text-blue-600">
                      {account.access}
                    </div>
                  </div>
                  <button
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      quickLogin(account.email);
                    }}
                    className="text-blue-600 text-sm hover:text-blue-800"
                  >
                    Quick Fill
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-md">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">
              💡 Testing Instructions
            </h3>
            <ol className="text-sm text-amber-700 space-y-1">
              <li>1. Click any test account to auto-fill login form</li>
              <li>2. Click "Login" to authenticate</li>
              <li>3. GraphQL Playground will open automatically</li>
              <li>4. Test different permission queries in the playground</li>
              <li>5. Compare access levels between different user roles</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <a
          href="/api/graphql"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          🚀 Open GraphQL Playground
        </a>
      </div>
    </div>
  );
}
