
import React, { useState, useEffect } from 'react';
import GenericCard from './GenericCard';
import { mockLoans } from '@/data/mockLoans';
import apiClient from '@/services/apiClient';
import { Button } from '@/components/ui/button';
import AddLoanModal from './AddLoanModal';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  CreditCard, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle,
  Clock,
  DollarSign,
  Calculator,
  FileText,
  Users
} from 'lucide-react';

import { LoanApplication } from '@/types/loan';

const LoanManagement: React.FC = () => {
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        // const data = await apiClient<LoanApplication[]>('/loans');
        // setApplications(data);
        setApplications(mockLoans); // Using mock data for now
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLoans();
  }, []);

  /**
   * Returns the color for the status badge based on the status.
   * @param status The status of the loan application.
   * @returns The color for the status badge.
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'disbursed': return 'bg-blue-100 text-blue-800';
      case 'under_review': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * Returns the icon for the status badge based on the status.
   * @param status The status of the loan application.
   * @returns The icon for the status badge.
   */
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'disbursed': return <DollarSign className="h-4 w-4 text-blue-500" />;
      case 'under_review': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'rejected': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };

  const getCreditScoreColor = (score: number) => {
    if (score >= 700) return 'text-green-600';
    if (score >= 600) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  const handleLoanAdded = (newLoan: LoanApplication) => {
    setApplications(prevApplications => [newLoan, ...prevApplications]);
  };

  const handleLoanStatusChange = (loanId: string, newStatus: 'approved' | 'rejected') => {
    setApplications(prevApplications =>
      prevApplications.map(app =>
        app.id === loanId ? { ...app, status: newStatus } : app
      )
    );
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Loan Management</h2>
        <AddLoanModal onLoanAdded={handleLoanAdded} />
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Applications</p>
                <p className="text-2xl font-bold">248</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold">189</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Portfolio Value</p>
                <p className="text-2xl font-bold">₦2.4B</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Default Rate</p>
                <p className="text-2xl font-bold">2.1%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="applications" className="w-full">
        <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="review">Under Review</TabsTrigger>
          <TabsTrigger value="portfolio">Active Loans</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="space-y-4">
          <div className="space-y-4">
            {applications.map((application) => (
              <GenericCard
                key={application.id}
                title={application.customerName}
                subtitle={`Application ID: ${application.id}`}
                icon={<CreditCard className="h-6 w-6 text-blue-600" />}
                status={application.status.replace('_', ' ')}
                statusColor={getStatusColor(application.status)}
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                    <div>
                      <p className="text-sm text-gray-600">Loan Type</p>
                      <p className="font-medium">{application.loanType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Requested Amount</p>
                      <p className="font-medium">{formatCurrency(application.requestedAmount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Credit Score</p>
                      <p className={`font-medium ${getCreditScoreColor(application.creditScore)}`}>
                        {application.creditScore}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Tenure</p>
                      <p className="font-medium">{application.repaymentPeriod} months</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm text-gray-600">Purpose</p>
                    <p className="font-medium">{application.purpose}</p>
                  </div>

                  <div className="flex items-center justify-between mt-6">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(application.status)}
                      <span className="text-sm font-medium">
                        {application.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      {application.status === 'under_review' && (
                        <>
                          <Button variant="outline" size="sm" className="text-green-600" onClick={() => handleLoanStatusChange(application.id, 'approved')}>
                            Approve
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleLoanStatusChange(application.id, 'rejected')}>
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
              </GenericCard>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="review">
          <Card>
            <CardContent className="p-6 text-center">
              <Clock className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
              <h3 className="text-lg font-medium mb-2">Applications Under Review</h3>
              <p className="text-gray-600 mb-4">AI Credit Analyzer is processing 5 applications</p>
              <Button className="banking-gradient text-white">
                View Queue
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portfolio">
          <Card>
            <CardHeader>
              <CardTitle>Active Loan Portfolio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Personal Loans</span>
                  <span className="font-medium">₦850M (35%)</span>
                </div>
                <Progress value={35} className="h-2" />
                
                <div className="flex items-center justify-between">
                  <span>SME Loans</span>
                  <span className="font-medium">₦1.2B (50%)</span>
                </div>
                <Progress value={50} className="h-2" />
                
                <div className="flex items-center justify-between">
                  <span>Asset Finance</span>
                  <span className="font-medium">₦350M (15%)</span>
                </div>
                <Progress value={15} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Disbursement Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-center justify-center text-gray-500">
                  Chart showing monthly loan disbursements
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Credit Score Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-center justify-center text-gray-500">
                  Chart showing credit score distribution
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LoanManagement;
